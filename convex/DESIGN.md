# convex

> 구현 전 설계 · 하루 PoC 범위는 [ROADMAP](../ROADMAP.md), 전체 연결은 [ARCHITECTURE](../ARCHITECTURE.md) 참고. 아래 컴포넌트는 구현 예정이다.

## 책임

DB의 원본 상태, 소유권 검증, 공개 query/mutation과 내부 orchestration을 소유한다.

## 구성

schema, assessments, content, responses, `workflows/`, `adapters/`.

## 데이터 송수신

GraphQL → 공개 함수: 검증할 사용자 신원과 DTO. mutation → workflows: assessmentId/runId. workflows → internal mutation: feature·추천·질문·일정 결과. query → GraphQL: 사용자에게 허용된 데이터.

## 설계 제약

외부 I/O는 action, DB 변경은 mutation. 소유권과 상태 전이는 DB 경계에서 최종 확인한다. 사용자 상태는 Python에 저장하지 않는다.

## Design Pattern 힌트

**CQRS의 가벼운 적용**: query와 command(mutation/action)를 분리한다. 별도 이벤트 DB나 범용 Repository 계층은 추가하지 않는다.
