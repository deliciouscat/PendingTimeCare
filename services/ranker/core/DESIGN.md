# services/ranker/core

> 구현 전 설계 · 하루 PoC 범위는 [ROADMAP](../../../ROADMAP.md), 전체 연결은 [ARCHITECTURE](../../../ARCHITECTURE.md) 참고. 아래 컴포넌트는 구현 예정이다.

## 책임

학습/추론 공통 feature 조립, BM25 baseline, XGBRanker 추론, MMR 선택.

## 구성

FeatureBuilder, BM25Strategy, XGBStrategy, diversity selector, manifest validator.

## 데이터 송수신

`training` → FeatureBuilder: 보고서 Q+칼럼 N/M → 학습 행. API → 동일 builder/strategy: 입력+모델 → 점수. 점수+문서 간 유사도 → MMR → Top-K.

## 설계 제약

feature 순서는 manifest 기준. 결측을 유지하고 N/M 차원·버전을 검사한다. λ=0.7, 동일 점수는 columnId 순, 빈 후보는 빈 결과. I/O·DB·외부 API 호출은 없다.

## Design Pattern 힌트

**Strategy + Functional Core**: BM25/XGB 선택을 인터페이스로 바꾸고 MMR은 별도 순수 함수로 합성한다. 학습/추론 전처리를 복제하지 않는다.
