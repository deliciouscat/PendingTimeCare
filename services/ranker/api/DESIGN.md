# services/ranker/api

> 구현 전 설계 · 하루 PoC 범위는 [ROADMAP](../../../ROADMAP.md), 전체 연결은 [ARCHITECTURE](../../../ARCHITECTURE.md) 참고. 아래 컴포넌트는 구현 예정이다.

## 책임

서버 간 HTTP 인증, 요청 검증, core 호출, 오류 변환.

## 구성

health endpoint, rank endpoint, request validation, response serialization.

## 데이터 송수신

RankerClient → API: requestId, Q, 후보 columnVersion/N/M/BM25용 본문 또는 토큰, K, 버전. API → core: 검증된 입력. core → API: ranked items/전략/버전. API → Convex: RankResponse.

## 설계 제약

서버 토큰을 검사하고 입력 수·크기·timeout을 제한한다. 이름·원본 보고서·자유응답은 받지 않는다. malformed 입력과 일시 장애를 구분한다.

## Design Pattern 힌트

**Adapter**: HTTP 형식을 core 입력으로 바꾼다. 모델 로직이나 DB 접근은 넣지 않는다.
