# apps/web/graphql

> 구현 전 설계 · 하루 PoC 범위는 [ROADMAP](../../../ROADMAP.md), 전체 연결은 [ARCHITECTURE](../../../ARCHITECTURE.md) 참고. 아래 컴포넌트는 구현 예정이다.

## 책임

브라우저의 유일한 업무 API. 입력 검증·인증·응답 축소를 담당한다.

## 구성

schema, resolvers, auth context, Convex client, error mapper.

## 데이터 송수신

UI → resolver: GraphQL query/mutation. resolver → `convex`: 인증 토큰, 검증된 DTO. Convex → resolver: 상태/허용된 콘텐츠/저장 결과. resolver → UI: 공개 DTO 또는 안정적인 오류 코드.

## 설계 제약

guardianId를 입력값으로 신뢰하지 않는다. 일반 브라우저 신원으로 internal 함수를 호출하는 관리자 우회 경로를 만들지 않는다. 오래 걸리는 작업은 ID/status를 반환한다.

## Design Pattern 힌트

**Facade + DTO**: Convex 업무 기능의 얇은 외관을 제공한다. workflow·추천 규칙은 resolver에 넣지 않는다.
