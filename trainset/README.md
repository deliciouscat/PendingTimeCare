# LambdaMART trainset 규격

> 이 디렉터리는 규격 템플릿만 담는다. 실제 학습 사례나 제공받은 CBCL 보고서는 넣지 않았다.

## 파일 계약

| 파일 | 상태 | 용도 |
|---|---|---|
| `schema.template.json` | 포함 | 학습 pair 한 행의 JSON Schema |
| `manifest.template.json` | 포함 | feature 축·공급자·split 버전의 작성 템플릿 |
| `manifest.json` | 추후 생성 | 채워진 feature 순서와 데이터 출처 |
| `train.jsonl`, `validation.jsonl`, `test.jsonl` | 추후 생성 | UTF-8 JSON Lines; 한 줄에 `(보고서, 후보 칼럼)` pair 하나 |

현재 파이프라인은 상담 보고서·칼럼을 공통 featurizer로 처리하고 split JSONL·manifest를 새 artifact의 `dataset/`과 루트에 저장한다. 이 디렉터리는 형식 계약이며 실제 실행 결과는 `artifacts/<version>/`에 있다.

## 한 행의 형태

아래는 **형식을 설명하는 예시**이며 데이터 파일은 아니다. `q`, `n`, `m`의 위치는 manifest 배열 순서와 정확히 일치해야 한다.

```json
{"report_id":"synthetic-report-001","family_id":"synthetic-family-001","column_id":"demo-column-001","label":2,"feature_schema_version":"v1","q":[66,58,61,63,62,60],"n":[0.82,0.11,0.64],"m":[0.12,0.81,0.74,0.40,0.20,0.05]}
```

- `report_id`: ranking query ID. 같은 보고서의 후보는 동일한 Q를 사용한다.
- `family_id`: 원본과 증강 사례를 묶는 ID. 한 family는 한 split에만 들어간다.
- `column_id`: 후보 칼럼 버전을 식별하는 ID. 한 보고서 안에서 중복되면 안 된다.
- `label`: 상담 보고서와 후보 칼럼의 N·M 유사도 순위를 0..3으로 변환한 약한 지도 값. 같은 순위는 같은 값이며, 0은 후보 중 상대적으로 가장 낮다는 뜻이다. 사람이 매긴 주제별 점수가 아니다. 같은 보고서의 label에 차이가 있어야 학습 신호가 생긴다.
- `q`: 보고서 수치 feature. 미실시는 `null`로 표현하고 0점으로 바꾸지 않는다. 결측 여부를 별도 feature로 추가한다면 manifest에도 포함한다.
- `n`: 칼럼과 기준문서 간 유사도. `reference_document_ids` 순서로 저장한다.
- `m`: 칼럼의 상담유형별 Jev Noul 관련도. `consultation_type_ids` 순서이고 각 값은 `[0,1]`; 합은 1일 필요가 없다.
- `feature_schema_version`: manifest와 같아야 한다.

각 `report_id`에는 같은 후보 칼럼 집합을 제공해 비교 가능한 ranking group을 만든다. 해당 보고서의 모든 행은 같은 split에 둔다. 최소한 보고서별 두 후보와 label 차이가 있는지 검증한다. 타인의 실제 보고서, 과제 원문, 개인정보는 trainset에 복사하지 않는다.

## manifest 채우기

`manifest.template.json`을 복사해 `manifest.json`을 만들고 `q_feature_order`, `reference_document_ids`, `consultation_type_ids`에 실제 ID를 순서대로 적는다. Q/N/M 배열 길이는 각각 이 목록 길이와 같아야 한다. taxonomy 또는 기준문서 축을 바꾸면 데이터와 모델을 새 버전으로 다시 생성한다. `source_mode`는 `mock` 또는 `live` 중 실제 생성 경로를 기록한다.

## 구현 경계

데이터 준비: `fixtures/synthetic/` + `content/` + feature snapshot → 이 디렉터리. 학습: 이 디렉터리 → [`training/lambdamart/`](../training/lambdamart/DESIGN.md) → `artifacts/`. 학습·서빙에서 사용할 feature 조립은 [`services/ranker/core/`](../services/ranker/core/DESIGN.md)와 공유한다.
