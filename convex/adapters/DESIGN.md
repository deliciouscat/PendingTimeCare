# convex/adapters

> 구현 전 설계 · 하루 PoC 범위는 [ROADMAP](../../ROADMAP.md), 전체 연결은 [ARCHITECTURE](../../ARCHITECTURE.md) 참고. 아래 컴포넌트는 구현 예정이다.

## 책임

Jev, reranker, 질문 LLM, Python 추천 HTTP 호출의 차이를 흡수한다.

## 구성

JevClient, ReferenceReranker, QuestionGenerator, RankerClient와 live/mock 구현.

## 데이터 송수신

workflows → adapter: 칼럼/질문 입력 또는 RankRequest. adapter → 공급자: 최소 payload. 공급자 → adapter: 원시 응답. adapter → workflows: 검증된 ColumnFeatures/QuestionDraft/RankResponse 또는 typed error.

## 설계 제약

Jev state는 칼럼이며 아동 원문을 전달하지 않는다. 기준문서 ID 순서를 복구하고 필수값 누락을 0으로 덮지 않는다. timeout·제한된 retry·모드·공급자 버전을 기록한다.

## Design Pattern 힌트

**Ports and Adapters + Dependency Injection**: workflow는 인터페이스를 사용한다. mock/live는 시작 설정에서 선택하고 업무 로직 내부 조건문으로 흩뿌리지 않는다.
