# convex/workflows

> 구현 전 설계 · 하루 PoC 범위는 [ROADMAP](../../ROADMAP.md), 전체 연결은 [ARCHITECTURE](../../ARCHITECTURE.md) 참고. 아래 컴포넌트는 구현 예정이다.

## 책임

보고서 처리, 칼럼 게시 준비, 질문 검토 연결, 예약 claim·복구를 조율한다.

## 구성

prepareColumn, processAssessment, generateQuestion, planSchedule, deliver, recoverExpiredLease.

## 데이터 송수신

게시 준비 → adapters: 칼럼 본문/기준문서/질문 정의 → N/M 또는 질문 초안 → internal mutation 저장. 보고서 처리 → ranker adapter: Q+후보 feature+K → 순위 → 일정 저장. Scheduler → deliver(scheduleId) → claim mutation → 노출 조건 재검사 → sent mutation.

## 설계 제약

action 사이에 assessmentId/runId/scheduleVersion을 전달한다. 처리 완료 커밋은 claimToken과 최신 버전을 검사한다. expired lease는 별도 주기 복구가 처리한다. sent는 조회 가능이라는 뜻이다.

## Design Pattern 힌트

**Process Manager + State Machine + Idempotent Consumer**: 긴 작업을 상태로 추적하고 재실행에 견딘다. 일정 계산은 Clock 주입을 받는 순수 함수로 둔다.
