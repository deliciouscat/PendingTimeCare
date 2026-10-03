"""Reproducible synthetic PoC, actual XGBRanker training, held-out evaluation."""
import argparse
import json
from pathlib import Path
import hashlib
import time
import os
from tempfile import TemporaryDirectory
from training.lambdamart.dataset import load_split
from training.lambdamart.supervision import derive_relevance, SUPERVISION_VERSION
import subprocess
import numpy as np
from xgboost import XGBRanker
from services.ranker.core.model import features, select, similarity, ndcg

ROOT = Path(__file__).resolve().parents[2]


def load(p):
    return json.loads((ROOT / p).read_text())


def prepare_features(columns_path=None, feature_mode=None):
    command = ['node', '--import', 'tsx', 'scripts/prepare-training-features.ts']
    if columns_path:
        command += ['--columns', str(Path(columns_path).resolve())]
    if feature_mode:
        command += ['--mode', feature_mode]
    result = subprocess.run(command, cwd=ROOT, stdout=subprocess.PIPE, text=True, check=True)
    return json.loads(result.stdout)


def _build(output, columns_path=None, model_version=None, feature_mode=None):
    output = Path(output)
    if output.exists():
        raise ValueError(f'Output already exists: {output}; choose a new version directory')
    output.mkdir(parents=True)
    config = load('config/poc.json')
    if [s['id'] for s in config['qScales']] != config['qFeatureOrder']:raise ValueError('INVALID_SCALE_ORDER')
    prepared = prepare_features(columns_path, feature_mode)
    columns = prepared['columns']
    notes = {note['reportId']: note for note in prepared['consultationFeatures']}
    reports = load('fixtures/synthetic/reports.json')
    candidates = [{'id':c['id'], 'body':c.get('rerankText',c['body']), 'n':c['n'],'m':c['m']} for c in columns]
    if len(notes) != len(reports) or set(notes) != {r['id'] for r in reports}:
        raise ValueError('INVALID_CONSULTATION_FEATURES')
    # Note vectors are offline supervision only, never an inference-time input.
    supervision = {r['id']: derive_relevance(notes[r['id']], candidates) for r in reports}
    column_index = {c['id']: i for i, c in enumerate(columns)}
    def label(report, column):
        return supervision[report['id']]['labels'][column_index[column['id']]]
    train, val, test = reports[:12], reports[12:16], reports[16:]
    groups = [set(r['familyId'] for r in split) for split in (train,val,test)]
    assert not any(groups[i] & groups[j] for i in range(3) for j in range(i+1,3))
    split_notes = {name:{notes[r['id']]['contentHash'] for r in split}
                   for name,split in [('train',train),('validation',val),('test',test)]}
    data_audit = {'uniqueConsultationNotes':len({n['contentHash'] for n in notes.values()}),
                  'noteHashOverlap':{'trainValidation':len(split_notes['train'] & split_notes['validation']),
                                     'trainTest':len(split_notes['train'] & split_notes['test'])},
                  'limitation':'Families are disjoint, but repeated synthetic note templates can cross splits; evaluation is not on unseen consultation narratives.'}
    dataset_dir = output/'dataset';dataset_dir.mkdir()
    for name,split in [('train',train),('validation',val),('test',test)]:
        rows=[{'report_id':r['id'],'family_id':r['familyId'],'column_id':c['id'],'label':label(r,c),'feature_schema_version':'v1','q':r['q'],'n':c['n'],'m':c['m']} for r in split for c in columns]
        (dataset_dir/f'{name}.jsonl').write_text(''.join(json.dumps(row,ensure_ascii=False)+'\n' for row in rows))
    modes={d['sourceMode'] for d in columns + list(notes.values())}
    source_mode=next(iter(modes)) if len(modes)==1 else 'mixed'
    manifest={**config,'mode':source_mode,'sourceMode':source_mode,'modelVersion':model_version or output.name,'featureOrder': config['qFeatureOrder']+[f'n:{x}' for x in config['referenceIds']]+[f'm:{x}' for x in config['consultationTypes']], 'split':{'train':[r['familyId'] for r in train],'validation':[r['familyId'] for r in val],'test':[r['familyId'] for r in test]},'dataAudit':data_audit,'supervisionVersion':SUPERVISION_VERSION,'supervisionMethod':{'similarity':'0.5*cosine(N_note,N_column)+0.5*cosine(M_note,M_column)','labels':'relative similarity rank discretized to 0..3; ties share labels','scoreRounding':6,'noteFeatureUsage':'offline supervision only'},'tokenizer':'words-korean-bigrams-v1','providers': [c.get('events',[]) for c in columns],'consultationProviders':{r['id']:notes[r['id']]['events'] for r in reports},'consultationContentHashes':{r['id']:notes[r['id']]['contentHash'] for r in reports},'featurePromptVersion':prepared['columns'][0]['featurePromptVersion'],'contentHash':hashlib.sha256(json.dumps(columns,sort_keys=True,ensure_ascii=False).encode()).hexdigest()}
    x,y,train_groups,train_families=load_split(dataset_dir/'train.jsonl')
    xv,yv,val_groups,val_families=load_split(dataset_dir/'validation.jsonl')
    _,_,_,test_families=load_split(dataset_dir/'test.jsonl')
    if train_families&val_families or train_families&test_families or val_families&test_families:raise ValueError('SPLIT_LEAKAGE')
    model=XGBRanker(objective='rank:ndcg',n_estimators=180,max_depth=3,learning_rate=0.08,min_child_weight=0.1,random_state=42,n_jobs=2,eval_metric='ndcg@3')
    model.fit(x,y,group=train_groups,eval_set=[(xv,yv)],eval_group=[val_groups],verbose=False)
    model.save_model(output/'model.ubj')
    def evaluate(split):
        result={}
        for diverse in (False,True):
            metrics=[]
            for r in split:
                started=time.perf_counter();scores=model.predict(features(r['q'],candidates));selected=select(scores,candidates,3,diverse)
                sim=similarity(candidates)
                pairs=[sim[i,j] for pos,i in enumerate(selected) for j in selected[pos+1:]]
                metrics.append({'ndcgAt3':ndcg([label(r,c) for c in columns],selected),'topicCoverage':len({columns[i]['topic'] for i in selected})/3,'meanSimilarity':float(np.mean(pairs)) if pairs else 0,'latencyMs':(time.perf_counter()-started)*1000})
            result['xgbMmr' if diverse else 'xgb']={key:float(np.mean([m[key] for m in metrics])) for key in metrics[0]}
        return result
    metrics={'validation':evaluate(val),'test':evaluate(test),'reportCount':len(reports),'pairCount':len(reports)*len(columns),'dataAudit':data_audit,'sourceMode':source_mode,'supervisionVersion':SUPERVISION_VERSION,'limitation':'Synthetic reports and model-derived weak relevance labels; pipeline evaluation only, not expert or clinical validation.'}
    (output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    (output/'metrics.json').write_text(json.dumps(metrics,ensure_ascii=False,indent=2)+'\n')
    (output/'consultation-features.json').write_text(json.dumps(list(notes.values()),ensure_ascii=False,indent=2)+'\n')
    (output/'supervision.json').write_text(json.dumps({'columnOrder':[c['id'] for c in columns],'reports':supervision},ensure_ascii=False,indent=2)+'\n')
    (output/'columns.json').write_text(json.dumps(candidates,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(metrics,ensure_ascii=False,indent=2))

def run(output, columns_path=None, feature_mode=None):
    target=Path(output)
    if target.exists():raise ValueError(f'Output already exists: {target}; choose a new version directory')
    target.parent.mkdir(parents=True,exist_ok=True)
    with TemporaryDirectory(prefix='.pending-training-',dir=target.parent) as temp:
        prepared=Path(temp)/'run'
        _build(prepared,columns_path,target.name,feature_mode)
        os.replace(prepared,target)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',default=str(ROOT/'artifacts'/'poc-consultation-v2'));parser.add_argument('--columns');parser.add_argument('--feature-mode',choices=['auto','mock','live']);args=parser.parse_args();run(args.output,args.columns,args.feature_mode)
