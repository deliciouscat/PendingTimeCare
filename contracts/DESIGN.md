# contracts

> 구현 전 설계 · 하루 PoC 범위는 [ROADMAP](../ROADMAP.md), 전체 연결은 [ARCHITECTURE](../ARCHITECTURE.md) 참고. 아래 컴포넌트는 구현 예정이다.

## 책임

TS와 Python이 공유하는 데이터 계약의 원본.

## 구성

Report, ColumnFeatures, QuestionDraft, RankRequest/Response, CareItem schema 및 검증 예제.

## 데이터 송수신

contracts → GraphQL/Convex/Python/training/tests: schema와 fixture. 각 런타임은 JSON Schema에서 타입을 생성하거나 같은 schema로 검증한다. 이 디렉터리는 다른 컴포넌트를 import하지 않는다.

## 설계 제약

questionPrompt(노출 질문)와 generationPrompt(내부 지시문)를 구분한다. requestId·schemaVersion·columnVersion·feature 순서를 계약에 포함한다. 변경 시 호환 버전과 fixture를 함께 갱신한다.

## Design Pattern 힌트

**Contract-First + DTO**: 저장 엔티티를 그대로 외부 응답으로 쓰지 않는다. 언어마다 독립적인 계약을 중복 정의하지 않는다.
