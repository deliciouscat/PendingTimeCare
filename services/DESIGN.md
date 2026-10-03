# services

> 구현 전 설계 · 하루 PoC 범위는 [ROADMAP](../ROADMAP.md), 전체 연결은 [ARCHITECTURE](../ARCHITECTURE.md) 참고. 아래 컴포넌트는 구현 예정이다.

## 책임

독립 실행 가능한 추론 서비스의 상위 경계. PoC에서는 ranker만 둔다.

## 구성

`ranker/`: Python 추천 서비스.

## 데이터 송수신

Convex adapter → ranker: 인증된 HTTP RankRequest. ranker → Convex: RankResponse. 학습 프로세스는 ranker/core를 직접 사용한다.

## 설계 제약

서비스 간 공유 DB를 만들지 않는다. 데이터 소유권은 Convex에 남긴다.

## Design Pattern 힌트

**Service Boundary**: 언어·실행 환경이 다른 추천 기능만 분리하고 불필요한 마이크로서비스를 늘리지 않는다.
