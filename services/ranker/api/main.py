import hmac
import json
import os
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from contextlib import asynccontextmanager
from jsonschema import Draft202012Validator
from xgboost import XGBRanker
from services.ranker.core.model import features, select
from services.questions.prompts import QuestionInput, render_question_input
from pydantic import ValidationError

ROOT=Path(__file__).resolve().parents[3]
ARTIFACT=Path(os.environ.get('RANKER_ARTIFACT',ROOT/'artifacts'/'poc-v1'))
TOKEN=os.environ.get('RANKER_TOKEN','')
validator=Draft202012Validator(json.loads((ROOT/'contracts/rank-request.schema.json').read_text()))
model=None
manifest=None

@asynccontextmanager
async def lifespan(app):
    global model,manifest
    if not TOKEN:
        raise RuntimeError('RANKER_TOKEN is required')
    manifest=json.loads((ARTIFACT/'manifest.json').read_text())
    config=json.loads((ROOT/'config/poc.json').read_text())
    if any(manifest[key]!=config[key] for key in ['featureSchemaVersion','referenceSetVersion','taxonomyVersion','referenceIds','consultationTypes']) or manifest['featureOrder'] != config['qFeatureOrder']+[f'n:{v}' for v in config['referenceIds']]+[f'm:{v}' for v in config['consultationTypes']]:
        raise RuntimeError('INVALID_MANIFEST')
    model=XGBRanker();model.load_model(ARTIFACT/'model.ubj')
    if model.n_features_in_!=15:raise RuntimeError('INVALID_MODEL_DIMENSION')
    yield

app=FastAPI(docs_url=None,redoc_url=None,lifespan=lifespan)

@app.get('/health')
def health():
    return {'status':'ready' if model is not None else 'starting','modelVersion':manifest['modelVersion'] if manifest else None}

@app.post('/rank')
async def rank(request:Request):
    if not hmac.compare_digest(request.headers.get('authorization',''),f'Bearer {TOKEN}'):
        raise HTTPException(401,'UNAUTHORIZED')
    body=await request.body()
    if len(body)>500000:raise HTTPException(413,'INPUT_TOO_LARGE')
    try:
        payload=json.loads(body);validator.validate(payload)
        for key in ['featureSchemaVersion','referenceSetVersion','taxonomyVersion']:
            if payload[key]!=manifest[key]:raise ValueError('VERSION_MISMATCH')
        matrix=features(payload['q'],payload['candidates'])
        scores=model.predict(matrix) if len(matrix) else []
        selected=select(scores,payload['candidates'],payload['k'])
    except Exception as e:
        raise HTTPException(422,'INVALID_INPUT') from e
    return {'requestId':payload['requestId'],'modelVersion':manifest['modelVersion'],'algorithmVersion':manifest['algorithmVersion'],'sourceMode':manifest['sourceMode'],'items':[{'columnId':payload['candidates'][i]['id'],'rank':rank+1,'score':float(scores[i])} for rank,i in enumerate(selected)]}


@app.post('/question-input')
async def question_input(request: Request):
    if not hmac.compare_digest(request.headers.get('authorization', ''), f'Bearer {TOKEN}'):
        raise HTTPException(401, 'UNAUTHORIZED')
    body = await request.body()
    if len(body) > 500000:
        raise HTTPException(413, 'INPUT_TOO_LARGE')
    try:
        payload = QuestionInput.model_validate_json(body)
    except ValidationError as error:
        raise HTTPException(422, 'INVALID_QUESTION_INPUT') from error
    return render_question_input(payload)
