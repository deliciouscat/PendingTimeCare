# artifacts

> 구현 전 설계 · 하루 PoC 범위는 [ROADMAP](../ROADMAP.md), 전체 연결은 [ARCHITECTURE](../ARCHITECTURE.md) 참고. 아래 컴포넌트는 구현 예정이다.

## 책임

생성된 모델·feature snapshot·manifest·평가 기록의 버전별 저장 위치.

## 구성

향후 run별 model, feature manifest, split, metrics, feature snapshot.

## 데이터 송수신

scripts → artifacts: 게시 준비 feature snapshot. training → artifacts: 모델·평가. artifacts → ranker: 읽기 전용 모델+manifest. tests → artifacts: 버전 일치 확인.

## 설계 제약

원시 민감 보고서·키를 저장하지 않는다. mock/live, 공급자 모델, source hash, schema/축/토크나이저 버전, seed를 남긴다. 결과를 제자리 덮어쓰지 않는다.

## Design Pattern 힌트

**Immutable Artifact + Manifest**: 모델과 전처리 계약을 한 묶음으로 다룬다. 런타임 코드는 두지 않는다.
