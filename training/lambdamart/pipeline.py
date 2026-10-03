"""Reproducible synthetic PoC, actual XGBRanker training, held-out evaluation."""
import argparse
import json
from pathlib import Path
import hashlib
import time
import os
from tempfile import TemporaryDirectory
from training.lambdamart.dataset import load_split
import numpy as np
from xgboost import XGBRanker
from services.ranker.core.model import features, select, similarity, ndcg

ROOT = Path(__file__).resolve().parents[2]


def load(p):
    return json.loads((ROOT / p).read_text())


def _build(output, columns_path=None, model_version=None):
    output = Path(output)
    if output.exists():
        raise ValueError(f'Output already exists: {output}; choose a new version directory')
    output.mkdir(parents=True)
    config = load('config/poc.json')
    if [s['id'] for s in config['qScales']] != config['qFeatureOrder']:raise ValueError('INVALID_SCALE_ORDER')
    columns = json.loads(Path(columns_path).read_text()) if columns_path else load('content/columns.json')
    reports = load('fixtures/synthetic/reports.json')
    candidates = [{'id':c['id'], 'body':c['body'], **c['mockFeatures']} for c in columns]
    # Separate human-readable synthetic note topic rubric, not Jev scores.
    def label(report, column):
        topic = column['topic']
        return 3 if topic == report['observationTopics'][0] else (2 if topic in report['observationTopics'] else 0)
    train, val, test = reports[:12], reports[12:16], reports[16:]
    groups = [set(r['familyId'] for r in split) for split in (train,val,test)]
    assert not any(groups[i] & groups[j] for i in range(3) for j in range(i+1,3))
    dataset_dir = output/'dataset';dataset_dir.mkdir()
    for name,split in [('train',train),('validation',val),('test',test)]:
        rows=[{'report_id':r['id'],'family_id':r['familyId'],'column_id':c['id'],'label':label(r,c),'feature_schema_version':'v1','q':r['q'],'n':c['mockFeatures']['n'],'m':c['mockFeatures']['m']} for r in split for c in columns]
        (dataset_dir/f'{name}.jsonl').write_text(''.join(json.dumps(row,ensure_ascii=False)+'\n' for row in rows))
    modes={c.get('sourceMode','mock') for c in columns}
    source_mode=next(iter(modes)) if len(modes)==1 else 'mixed'
    manifest={**config,'sourceMode':source_mode,'modelVersion':model_version or output.name,'featureOrder': config['qFeatureOrder']+[f'n:{x}' for x in config['referenceIds']]+[f'm:{x}' for x in config['consultationTypes']], 'split':{'train':[r['familyId'] for r in train],'validation':[r['familyId'] for r in val],'test':[r['familyId'] for r in test]},'labelRubric':'synthetic-note-topic-v1','tokenizer':'words-korean-bigrams-v1','providers': [c.get('events',[]) for c in columns],'contentHash':hashlib.sha256(json.dumps(columns,sort_keys=True,ensure_ascii=False).encode()).hexdigest()}
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
    metrics={'validation':evaluate(val),'test':evaluate(test),'reportCount':20,'pairCount':120,'sourceMode':source_mode,'limitation':'Synthetic pipeline evaluation; no clinical validation.'}
    (output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    (output/'metrics.json').write_text(json.dumps(metrics,ensure_ascii=False,indent=2)+'\n')
    (output/'columns.json').write_text(json.dumps(candidates,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(metrics,ensure_ascii=False,indent=2))

def run(output, columns_path=None):
    target=Path(output)
    if target.exists():raise ValueError(f'Output already exists: {target}; choose a new version directory')
    target.parent.mkdir(parents=True,exist_ok=True)
    with TemporaryDirectory(prefix='.pending-training-',dir=target.parent) as temp:
        prepared=Path(temp)/'run'
        _build(prepared,columns_path,target.name)
        os.replace(prepared,target)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',default=str(ROOT/'artifacts'/'poc-v1'));parser.add_argument('--columns');args=parser.parse_args();run(args.output,args.columns)
