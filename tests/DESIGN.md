# tests

> 구현 전 설계 · 하루 PoC 범위는 [ROADMAP](../ROADMAP.md), 전체 연결은 [ARCHITECTURE](../ARCHITECTURE.md) 참고. 아래 컴포넌트는 구현 예정이다.

## 책임

계약, 순수 로직, 권한·예약 경합, 전체 사용자 흐름 검증.

## 구성

contract tests, core tests, Convex integration tests, web E2E.

## 데이터 송수신

contracts/fixtures → tests. tests → core: feature/MMR 검증. tests → GraphQL/Convex: 소유권·중복·lease·무효화. tests → web: 응답 저장·복원. 테스트 결과 → 실행 로그/평가 보고.

## 설계 제약

Clock과 공급자 adapter를 주입해 날짜·장애를 재현한다. live API 테스트는 별도 명령으로 분리한다. assertion은 구현 복제보다 사용자 결과와 상태 불변식을 확인한다.

## Design Pattern 힌트

**Test Double + Contract Test**: mock/live가 같은 계약을 지키도록 검증하고 핵심 E2E 한 경로를 유지한다.
