# training

> 구현 전 설계 · 하루 PoC 범위는 [ROADMAP](../ROADMAP.md), 전체 연결은 [ARCHITECTURE](../ARCHITECTURE.md) 참고. 아래 컴포넌트는 구현 예정이다.

## 책임

합성 pair 구성부터 분할·학습·평가·모델 저장까지 오프라인 파이프라인.

## 구성

[`lambdamart/`](lambdamart/DESIGN.md)에 dataset validator, family split 확인, train CLI, evaluate CLI를 구현할 예정이다. 학습 입력 규격은 루트 [`trainset/`](../trainset/README.md)에 둔다.

## 데이터 송수신

`fixtures/synthetic` + `content` + 검증된 feature snapshot + `config` → `trainset/` 작성. `trainset/` → `training/lambdamart`: 학습 pair와 manifest. training → `services/ranker/core`: feature 조립. training → `artifacts`: 모델/manifest/split/평가 결과. feature snapshot은 scripts가 Convex의 같은 게시 준비 경로로 얻는다.

## 설계 제약

20×6=120 pair, family 단위 12/4/4 split을 당일 목표로 한다. 테스트 결과로 반복 튜닝하지 않는다. Jev 출력을 label로 복제하지 않는다.

## Design Pattern 힌트

**Pipeline**: build → split → train → evaluate → export 단계와 입출력을 명시한다. 고정 seed·manifest로 재현한다.
