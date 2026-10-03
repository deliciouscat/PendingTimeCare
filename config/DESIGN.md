# config

> 구현 전 설계 · 하루 PoC 범위는 [ROADMAP](../ROADMAP.md), 전체 연결은 [ARCHITECTURE](../ARCHITECTURE.md) 참고. 아래 컴포넌트는 구현 예정이다.

## 책임

비밀이 아닌 버전 관리 설정과 모델 선택 정책.

## 구성

taxonomy, referenceSet, featureSchema, schedulePolicy, model/provider mapping, demo 설정.

## 데이터 송수신

config → Convex workflows/adapters: 질문 정의·일정·모드. config → training/ranker: 동일 feature 축·알고리즘. model mapping → artifacts manifest 검증.

## 설계 제약

API 키·서버 토큰은 환경 변수로만 받는다. 정상 일정과 단축 데모 일정을 분리한다. 설정 버전은 저장 결과에 기록한다.

## Design Pattern 힌트

**Configuration Object + Dependency Injection**: 시작 시 검증해 주입한다. 업무 코드에 모델명·시간 간격을 산재시키지 않는다.
