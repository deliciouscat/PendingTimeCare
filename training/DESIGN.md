# training

검사 보고서와 연결된 가상 상담 보고서, 후보 칼럼을 이용한 오프라인 학습 파이프라인.

`lambdamart/pipeline.py` → 공통 reranker·Jev 문서 featurization → 상담 보고서/칼럼 N·M 유사도로 약한 지도 label 생성 → 가족 단위 분할 → XGBRanker 학습·평가 → 새 artifact 저장.

Ranker 입력은 Q+후보 칼럼 N+M이다. 상담 보고서 N+M은 학습 supervision에만 사용하며 observationTopics를 label로 사용하지 않는다. 상세 계약과 실행은 [lambdamart/DESIGN.md](lambdamart/DESIGN.md)를 따른다.
