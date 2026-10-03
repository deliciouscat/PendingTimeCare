# apps/web

> 구현 전 설계 · 하루 PoC 범위는 [ROADMAP](../../ROADMAP.md), 전체 연결은 [ARCHITECTURE](../../ARCHITECTURE.md) 참고. 아래 컴포넌트는 구현 예정이다.

## 책임

웹 실행 단위와 인증 연결을 담당한다. Next.js를 구현 후보로 둔다.

## 구성

`ui/`와 `graphql/`을 조립한다. 향후 프레임워크 route 파일은 두 모듈로 위임한다.

## 데이터 송수신

브라우저 → 인증 제공자: 로그인. `ui` → `graphql`: 서비스 데이터 요청. 서버 GraphQL → Convex: 사용자 토큰 전달. 서버 환경 변수는 브라우저로 보내지 않는다.

## 설계 제약

클라이언트는 Convex·Python·외부 AI를 직접 호출하지 않는다. 상태 갱신은 당일 단순 polling으로 충분하다.

## Design Pattern 힌트

**Composition Root**: 인증·GraphQL client·서버 의존성을 실행 진입점에서 조립한다.
