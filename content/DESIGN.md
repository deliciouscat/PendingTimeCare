# content

> 구현 전 설계 · 하루 PoC 범위는 [ROADMAP](../ROADMAP.md), 전체 연결은 [ARCHITECTURE](../ARCHITECTURE.md) 참고. 아래 컴포넌트는 구현 예정이다.

## 책임

직접 작성한 기준문서·후보 칼럼·고정 질문·용어집의 seed 원본.

## 구성

기준문서 3개, 후보 6개, fallback 질문, 용어집 1개와 검토 metadata.

## 데이터 송수신

content → scripts → Convex: ID/본문/버전/검토 기록. 게시 준비 workflow → adapters: 본문으로 feature·초안 생성. content → training: label rubric에 사용할 주제 정보.

## 설계 제약

개발자 데모 검토와 전문가 검수를 구분한다. AI 생성 질문은 자동 reviewed 처리하지 않는다. 원본 샘플·비공개 과제를 포함하지 않는다.

## Design Pattern 힌트

**Content Lifecycle / State Machine**: draft → reviewed → published, 변경 시 새 버전. 데이터 디렉터리에 불필요한 클래스는 만들지 않는다.
