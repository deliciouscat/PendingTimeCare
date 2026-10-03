# LambdaMART 학습

> 현재는 디렉터리와 데이터 계약만 정의한다. 학습 코드와 모델은 아직 없다. 전체 흐름은 [ARCHITECTURE.md](../../ARCHITECTURE.md), 구현 순서는 [ROADMAP.md](../../ROADMAP.md)를 따른다.

## 책임

`trainset/`의 보고서별 후보 칼럼 데이터를 읽어 XGBRanker(LambdaMART)를 학습·평가한다. 학습 결과와 feature manifest를 `artifacts/`로 내보낸다.

## 예정 컴포넌트

| 컴포넌트 | 입력 → 출력 |
|---|---|
| Dataset loader/validator | `trainset/manifest.json` + split별 JSONL → 검증된 보고서별 후보 묶음 |
| Feature builder | Q, N, M 배열 + manifest 순서 → 고정 길이 수치 벡터. 추론 시에는 `services/ranker/core`와 같은 구현을 사용 |
| Trainer | 보고서별 후보 묶음 + 관련도 label → XGBRanker 모델 |
| Evaluator | 모델 + validation/test 묶음 → NDCG@3, 사용한 split·버전 기록 |
| Exporter | 모델·평가 결과·feature 순서 → `artifacts/`의 버전별 결과 |

## 데이터 흐름과 경계

`content/`의 기준문서·칼럼, `config/`의 taxonomy·feature 축을 이용해 Convex 게시 준비 흐름이 N/M feature를 생성한다. `scripts/`가 이를 버전 고정 snapshot으로 내보내고, 공개 가능한 합성 보고서의 Q·label과 결합해 `trainset/`에 입력을 작성한다. 학습 모듈은 `trainset/`을 읽고 `artifacts/`에만 결과를 쓴다. 운영 사용자 데이터나 Convex DB를 학습 코드가 직접 조회하지 않는다.

`trainset/`에는 지금 [README.md](../../trainset/README.md), [schema.template.json](../../trainset/schema.template.json), [manifest.template.json](../../trainset/manifest.template.json)만 있다. 실제 `manifest.json`과 `train.jsonl`·`validation.jsonl`·`test.jsonl`은 데이터 준비 단계에서 생성한다.

## 학습 시 지킬 조건

- 한 JSONL 행은 보고서 하나와 후보 칼럼 하나의 pair다. 같은 `report_id`의 모든 후보를 하나의 ranking query group으로 묶는다. 정렬하거나 group 크기를 계산한 뒤 `XGBRanker.fit`에 전달한다.
- `family_id` 단위로 train/validation/test를 나눠 동일 사례의 변형이 다른 split에 들어가지 않게 한다. split별로 각 보고서에 여러 후보와 구분 가능한 label이 있어야 한다.
- 학습과 추론은 동일한 Q+N+M 순서, 결측 표현, 전처리 버전을 써야 한다. N은 `reference_document_ids`, M은 `consultation_type_ids` 순서다. Jev의 독립 확률을 합계 1로 정규화하지 않는다.
- label은 0~3 정수의 칼럼 관련도이며 Jev 점수를 그대로 label로 삼지 않는다. 합성 데이터 평가는 파이프라인 검증 결과로만 해석한다.

## Design Pattern 힌트

**Pipeline**: load → validate → split 확인 → feature build → train → evaluate → export. **Shared Functional Core**: 학습/서빙에서 feature builder를 재사용한다. **Immutable Artifact**: 모델과 manifest를 같은 버전으로 보존한다.
