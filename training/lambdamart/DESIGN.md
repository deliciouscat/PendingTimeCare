# LambdaMART 학습

## 구현과 데이터 흐름

`pipeline.py`가 `scripts/prepare-training-features.ts`를 실행한다. 칼럼 본문과 가상 상담 보고서의 `consultationNote` 모두 같은 `documentFeatures`를 사용한다.

- **N:** 문서 본문을 query, 공통 기준문서 3개를 documents로 reranker에 전달한다. 반환 순서를 기준문서 ID 순서로 복원한다.
- **M:** 같은 문서 본문을 Jev state로 전달하고 상담유형 6개를 독립 Noul로 평가한다. 합계 1 정규화는 하지 않는다.
- **Q:** 검사 보고서의 수치 6개. 상담 보고서와 연결된 원래 Q를 사용한다.

`API_MODE=auto`는 `.env`의 API 키가 있으면 live를 사용한다. `--feature-mode live`는 키 누락·공급자 오류에서 실패하며 mock으로 바꾸지 않는다. mock에서는 본문과 기준문서·유형 설명 간 lexical overlap으로 테스트용 N·M을 만든다. 이는 실제 Jev·reranker 결과가 아니다. `observationTopics`와 칼럼 topic 태그는 학습 label에 사용하지 않는다.

내용·모델·프롬프트·축·mock/live를 cache key에 포함하고 `.runtime/training-feature-cache/`에 저장한다. 동일한 문서는 API 재호출 없이 재사용한다.

## 약한 지도 신호

`supervision.py`에서 상담 보고서와 각 후보 칼럼의 공통 의미 좌표를 비교한다.

```text
similarity = 0.5 × cosine(N_상담, N_칼럼) + 0.5 × cosine(M_상담, M_칼럼)
```

각 block의 길이에 영향을 받지 않게 cosine을 따로 계산한다. 보고서별 유사도 순위를 0..3으로 변환해 `rank:ndcg`의 관련도 label로 사용한다. 6자리 반올림으로 같은 점수는 같은 label이며, 전부 동점이면 학습 신호가 없어 실패한다. 0은 후보 집합에서 상대적으로 낮다는 뜻이며 절대적인 무관함을 뜻하지 않는다.

상담 보고서 N·M은 **오프라인 supervision에만** 사용한다. Ranker의 학습·서빙 입력은 그대로 `[Q_검사, N_후보칼럼, M_후보칼럼]` 15차원이다. 상담 결과를 추론 입력에 섞지 않는다.

## 학습·평가·저장

가족 단위 train/validation/test 12/4/4 사례를 분리한다. 같은 보고서의 후보 전체가 ranking query group이다. 현재 합성 상담 메모는 6개 패턴을 반복하며 split 간 동일 본문이 있을 수 있다. manifest·metrics의 dataAudit에 고유 메모 수와 split 간 본문 hash 중복을 기록한다. 학습·서빙 feature 조립 함수를 공유하고, LambdaMART 단독·BM25 다양성 적용 결과의 NDCG@3와 칼럼 간 유사도를 비교한다. topicCoverage는 칼럼 메타데이터 기반 보조 지표이며 학습 정답은 아니다.

새 디렉터리에 model.ubj, manifest.json, metrics.json, columns.json, consultation-features.json, supervision.json, dataset/*.jsonl을 함께 저장한다. 기존 결과는 덮어쓰지 않는다. manifest에는 공급자·모델·축 순서·출처 hash·supervision 알고리즘·split을 기록한다.

## 실행

```sh
uv run python -m training.lambdamart.pipeline --output artifacts/poc-consultation-v2-live --feature-mode live
```

`--columns <snapshot.json>`은 준비된 칼럼 목록을 입력받되 현재 featurizer와 cache 계약으로 다시 확인·계산한다. 테스트는 `--feature-mode mock`으로 외부 호출 없이 실행한다.

합성 상담 메모와 모델 기반 관련도로 평가하므로 전문가 정답 기반 품질이나 실제 상담 효과를 입증하지 않는다.
