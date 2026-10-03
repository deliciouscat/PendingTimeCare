# apps/web/ui

> 구현 전 설계 · 하루 PoC 범위는 [ROADMAP](../../../ROADMAP.md), 전체 연결은 [ARCHITECTURE](../../../ARCHITECTURE.md) 참고. 아래 컴포넌트는 구현 예정이다.

## 책임

합성 보고서 선택, 준비 홈, 칼럼 상세, 질문 응답 화면.

## 구성

AssessmentForm, CareTimeline, ColumnView, QuestionForm, GraphQL client.

## 데이터 송수신

`AssessmentForm` → GraphQL: AssessmentInput/idempotencyKey. GraphQL → 화면: assessmentId/status, CareItem. `QuestionForm` → GraphQL: questionVersion/optionId/freeText 또는 skip. 저장 결과 → 진행 상태 갱신.

## 설계 제약

Q/N/M, 내부 점수, prompt를 표시하지 않는다. 자유응답은 텍스트로 출력하고 완료 수를 조작하지 않는다.

## Design Pattern 힌트

**Container/Presentational**: 조회·저장 상태와 표시 컴포넌트를 분리한다. 단순 상태는 hook으로 충분하며 전역 store를 미리 만들지 않는다.
