import json
from pathlib import Path
import numpy as np
import pytest
from services.ranker.core.model import features, similarity, select

ROOT=Path(__file__).resolve().parents[1]
from training.lambdamart.columns import load_columns
COLUMNS=load_columns()
COLS=[{'id':c['id'],'body':c['rerankText'],**c['mockFeatures']} for c in COLUMNS]

@pytest.fixture(scope='session')
def training_artifact(tmp_path_factory):
    from training.lambdamart.pipeline import run
    output=tmp_path_factory.mktemp('training')/'model'
    run(output)
    return output

def test_feature_contract_and_missing():
    matrix=features([60,None,50,55,62,49],COLS)
    assert matrix.shape==(len(COLS),15) and np.isnan(matrix[:,1]).all()
    assert matrix[0,9:].sum()>1
    with pytest.raises(ValueError):features([60]*5,COLS)
    with pytest.raises(ValueError):features([60]*6,[COLS[0],COLS[0]])
    with pytest.raises(ValueError):features([np.inf]*6,COLS)

def test_diversity_and_determinism():
    sim=similarity(COLS)
    assert np.allclose(sim,sim.T) and np.allclose(np.diag(sim),0)
    assert np.isfinite(sim).all() and (sim>=0).all() and (sim<=1).all()
    scores=np.ones(len(COLS))
    first=select(scores,COLS,8)
    assert len(first)==len(COLS) and len(set(first))==len(COLS)
    assert first==select(scores,COLS,8)
    assert select(scores,COLS,0)==[]
    assert select([],[],2)==[]
    assert np.array_equal(similarity([{'body':''},{'body':''}]),np.zeros((2,2)))
    with pytest.raises(ValueError):select([np.nan]*len(COLS),COLS,3)

def test_training_split_and_manifest(training_artifact):
    manifest=json.loads((training_artifact/'manifest.json').read_text())
    split=manifest['split'];groups=[set(split[name]) for name in ['train','validation','test']]
    assert [len(g) for g in groups]==[12,4,4]
    assert not (groups[0]&groups[1] or groups[1]&groups[2] or groups[0]&groups[2])
    assert len(manifest['featureOrder'])==15
    assert all('bm25' not in name.lower() for name in manifest['featureOrder'])

def test_api_auth_and_model(monkeypatch,training_artifact):
    monkeypatch.setenv('RANKER_TOKEN','test-token')
    monkeypatch.setenv('RANKER_ARTIFACT',str(training_artifact))
    import importlib
    from services.ranker.api import main
    importlib.reload(main)
    from fastapi.testclient import TestClient
    payload={'requestId':'case-1','featureSchemaVersion':'v1','referenceSetVersion':'refs-v1','taxonomyVersion':'topics-v1','q':[65,50,None,61,55,51],'candidates':COLS,'k':3}
    with TestClient(main.app) as client:
        assert client.post('/rank',json=payload).status_code==401
        good=client.post('/rank',json=payload,headers={'Authorization':'Bearer test-token'})
        assert good.status_code==200 and len(good.json()['items'])==3
        assert good.json()['requestId']=='case-1'
        bad={**payload,'featureSchemaVersion':'wrong'}
        assert client.post('/rank',json=bad,headers={'Authorization':'Bearer test-token'}).status_code==422

def test_dataset_rejects_no_signal_duplicates_and_inconsistent_q(tmp_path):
    from training.lambdamart.dataset import load_split
    row={'report_id':'r1','family_id':'f1','column_id':'c1','label':3,'feature_schema_version':'v1','q':[65]*6,'n':[.1]*3,'m':[.2]*6}
    path=tmp_path/'train.jsonl'
    def write(rows):path.write_text(''.join(json.dumps(r)+'\n' for r in rows))
    write([row,row])
    with pytest.raises(ValueError,match='DUPLICATE_PAIR'):load_split(path)
    write([row,{**row,'column_id':'c2'}])
    with pytest.raises(ValueError,match='NO_RANKING_SIGNAL'):load_split(path)
    write([row,{**row,'column_id':'c2','label':0,'q':[40]*6}])
    with pytest.raises(ValueError,match='INCONSISTENT_REPORT'):load_split(path)
    write([row,{**row,'column_id':'c2','label':0}])
    matrix,y,groups,families=load_split(path)
    assert matrix.shape==(2,15) and list(y)==[3,0] and groups==[2] and families=={'f1'}
