# scripts

> 구현 전 설계 · 하루 PoC 범위는 [ROADMAP](../ROADMAP.md), 전체 연결은 [ARCHITECTURE](../ARCHITECTURE.md) 참고. 아래 컴포넌트는 구현 예정이다.

## 책임

설치 이후 seed·feature export·학습·시연을 재현하는 얇은 명령 진입점.

## 구성

seed content, export features, train wrapper, smoke demo, review helper.

## 데이터 송수신

content/config → seed → 권한 제한 Convex 관리 함수. Convex feature 결과 → export → artifacts. fixtures → demo → GraphQL → 상태 polling. train wrapper → training CLI.

## 설계 제약

관리용 호출은 서버 자격 증명으로만 실행하고 일반 사용자 GraphQL에 노출하지 않는다. 추천·검수·일정 로직은 재구현하지 않는다. 공개·메일 전송은 자동 실행하지 않는다.

## Design Pattern 힌트

**Command + Composition Root**: 명령은 기존 모듈을 조립하고 종료 코드로 성공/실패를 알린다.
