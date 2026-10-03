# 상담 보고서 featurization 모델 학습 결과

- 모델: `artifacts/poc-consultation-v2-live-final/model.ubj`
- 실행: `uv run python -m training.lambdamart.pipeline --output artifacts/poc-consultation-v2-live-final --feature-mode live`
- 공급자: 칼럼과 상담 보고서 모두 OpenRouter Jev·reranker 실제 호출. Jev 응답 모델은 `typesafe/jev-1.13-20260917`, reranker 응답 모델은 `accounts/fireworks/models/qwen3-reranker-8b`다.
- 입력: Q 6 + 후보 칼럼 N 3 + M 6 = 15차원.
- 학습 데이터: 합성 검사 보고서 20건 × 칼럼 8개 = 160 pair. 가족 단위 12/4/4 분할.
- 약한 지도: 상담 보고서 N·M과 후보 칼럼 N·M의 block cosine 평균 유사도 순위를 0..3으로 변환. observationTopics는 학습 정답에 사용하지 않는다.
- Validation NDCG@3: Ranker 0.9759, 다양성 적용 0.9696.
- Test NDCG@3: Ranker 0.7652, 다양성 적용 0.7652.
- 검증: 타입 검사, JavaScript 27개·Python 16개 테스트 통과. 실제 저장된 모델을 읽는 `/rank` API도 200 응답·live 출처·추천 3개를 확인했다.

## 평가 범위

고유 상담 메모는 6개이며 train/validation 및 train/test에 동일 메모 패턴 4개씩이 겹친다. 가족은 분리했지만 새로운 상담 메모 패턴에 대한 일반화 평가가 아니다. 모델 기반 약한 지도 정답으로 측정한 합성 PoC 결과다. 실제 상담 효과·전문가 정답 기반 추천 품질을 입증하지 않는다.

상담 보고서 특성·유사도·정답·공급자 이력은 같은 artifact의 `consultation-features.json`, `supervision.json`, `manifest.json`, `metrics.json`에서 확인할 수 있다. 기존 모델은 보존했다.

새 모델로 서버를 실행하려면 Convex와 동일한 `RANKER_TOKEN` 환경이 설정된 상태에서 `RANKER_ARTIFACT=artifacts/poc-consultation-v2-live-final npm run ranker`를 사용한다. 서비스 재시작·모델 교체는 이번 학습 작업에서 수행하지 않았다.
