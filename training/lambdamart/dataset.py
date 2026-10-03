"""JSONL contract loader: one report-column pair per row, grouped for LambdaMART."""
import json
from pathlib import Path
import numpy as np
from jsonschema import Draft202012Validator
from services.ranker.core.model import features
ROOT=Path(__file__).resolve().parents[2]
VALIDATOR=Draft202012Validator(json.loads((ROOT/'trainset/schema.template.json').read_text()))


def load_split(path, feature_schema_version='v1'):
    rows=[json.loads(line) for line in Path(path).read_text().splitlines() if line.strip()]
    if not rows:
        raise ValueError('EMPTY_SPLIT')
    groups={}
    seen=set()
    for row in rows:
        VALIDATOR.validate(row)
        if row['feature_schema_version'] != feature_schema_version:
            raise ValueError('VERSION_MISMATCH')
        pair=(row['report_id'],row['column_id'])
        if pair in seen:raise ValueError('DUPLICATE_PAIR')
        seen.add(pair);groups.setdefault(row['report_id'],[]).append(row)
    matrices=[];labels=[];sizes=[];families=set()
    for report_id,group in sorted(groups.items()):
        group=sorted(group,key=lambda r:r['column_id'])
        if len(group)<2 or len({r['label'] for r in group})<2:
            raise ValueError('NO_RANKING_SIGNAL')
        if any(r['q']!=group[0]['q'] or r['family_id']!=group[0]['family_id'] for r in group):
            raise ValueError('INCONSISTENT_REPORT')
        candidates=[{'id':r['column_id'],'n':r['n'],'m':r['m']} for r in group]
        matrices.append(features(group[0]['q'],candidates));labels.extend(r['label'] for r in group)
        sizes.append(len(group));families.add(group[0]['family_id'])
    return np.concatenate(matrices),np.array(labels),sizes,families
