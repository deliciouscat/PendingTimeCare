# services/ranker/core

> 구현 전 설계 · 하루 PoC 범위는 [ROADMAP](../../../ROADMAP.md), 전체 연결은 [ARCHITECTURE](../../../ARCHITECTURE.md) 참고. 아래 컴포넌트는 구현 예정이다.

## 책임

학습/추론 공통 feature 조립, XGBRanker 관련도 추론, 칼럼 간 BM25 유사도 계산, MMR 다양성 선택.

## 구성

FeatureBuilder, XGBRanker scorer, BM25ColumnSimilarity, MMR selector, manifest validator.

## 데이터 송수신

`training` → FeatureBuilder: 보고서 Q+칼럼 N/M → 학습 행. API → 동일 builder/scorer: Q+N+M과 모델 → 후보별 관련도 점수. API → BM25ColumnSimilarity: 후보 칼럼 본문 또는 토큰 → 칼럼 간 유사도. 관련도 점수+유사도 → MMR → Top-K. BM25 점수는 학습 feature나 보고서-칼럼 관련도 점수로 사용하지 않는다.

## 설계 제약

feature 순서는 manifest 기준. 결측을 유지하고 N/M 차원·버전을 검사한다. λ=0.7, 동일 점수는 columnId 순, 빈 후보는 빈 결과. 칼럼 BM25 유사도는 후보 corpus를 고정해 계산한다. 음수는 0으로 자르고 자기 자신을 제외한 방향별 최대 점수로 정규화한 뒤 양방향 평균을 사용한다. 최대 점수가 0이면 해당 방향의 유사도는 0이다. 관련도 정규화와 토크나이저·BM25 설정도 알고리즘 버전으로 관리한다. I/O·DB·외부 API 호출은 없다.

## Design Pattern 힌트

**Composition + Functional Core**: XGBRanker scorer, BM25 similarity, MMR selector를 각각 순수 로직으로 분리하고 순서대로 합성한다. **Strategy**는 MMR 적용/미적용 선택에 사용할 수 있다. 학습/추론 전처리를 복제하지 않는다.
