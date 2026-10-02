# 가상 데이터
실제 시나리오에서는 '상담사 전화 상담' 프로세스 진행 후 상담 노트가 산출되지만, 현재 제공되지 않은 상태에서 PoC를 개발해야 함.
가상의 상담 보고서를 mock data로 만든다.

# 모델
- `xgboost.XGBRanker`
- `rank_bm25`
- `OpenRouter: typesafe/jev-1.13.0`
- `OpenRouter: voyageai/rerank-3`

# 루브릭
## 기준문서
reranker로 유사도를 비교하게 될 문서. 다양한 상담 양태를 커버하도록 상담 전문가가 작성한 칼럼을 N개로 구성한다.


## 상담유형 예시
Jev로 classification 결과값을 logit으로 받을 수 있도록 상담 유형 클래스를 정의한다.
- ADHD
- 경계선지능
- 내재화 문제 종합
- 우울/불안
- 사회적 미성숙
- 위축
- ...등등