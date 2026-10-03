# fixtures/synthetic

> 구현 전 설계 · 하루 PoC 범위는 [ROADMAP](../../ROADMAP.md), 전체 연결은 [ARCHITECTURE](../../ARCHITECTURE.md) 참고. 아래 컴포넌트는 구현 예정이다.

## 책임

실제 제공 샘플과 독립적인 합성 보고서·상담 노트·실패 사례.

## 구성

20개 보고서 family, 대응 노트, label 근거, 결측/날짜/질문 오류 fixture.

## 데이터 송수신

synthetic → training: report/notes/familyId. synthetic → tests: 기대 결과. synthetic → scripts → GraphQL: 합성 보고서 등록 시연.

## 설계 제약

동일 family의 변형은 train/test로 흩어지지 않는다. 개인정보처럼 보이는 값도 실샘플에서 가져오지 않는다.

## Design Pattern 힌트

**Data Builder + Table-Driven Tests**: 정상/경계/실패 조건을 데이터로 표현한다.
