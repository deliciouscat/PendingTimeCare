# apps

> 구현 전 설계 · 하루 PoC 범위는 [ROADMAP](../ROADMAP.md), 전체 연결은 [ARCHITECTURE](../ARCHITECTURE.md) 참고. 아래 컴포넌트는 구현 예정이다.

## 책임

사용자용 애플리케이션의 경계. 당일에는 web 하나만 둔다.

## 구성

`web/ui`: 화면, `web/graphql`: 서버 API.

## 데이터 송수신

`web/ui` → `web/graphql`: 인증된 요청. `web/graphql` → Convex: 검증한 신원과 업무 입력. 결과는 같은 경로로 돌아온다.

## 설계 제약

여기에 DB 접근이나 추천 로직을 중복 구현하지 않는다.

## Design Pattern 힌트

**Layered Architecture**: 화면과 서버 API를 디렉터리로 구분하되 별도 서버 배포까지 강제하지 않는다.
