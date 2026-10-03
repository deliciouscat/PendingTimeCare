# services/ranker

> 구현 전 설계 · 하루 PoC 범위는 [ROADMAP](../../ROADMAP.md), 전체 연결은 [ARCHITECTURE](../../ARCHITECTURE.md) 참고. 아래 컴포넌트는 구현 예정이다.

## 책임

학습된 모델을 로드해 보고서·후보별 추천 결과를 반환한다.

## 구성

`api/` HTTP 경계, `core/` 순수 추천 로직, 시작 시 모델 로더.

## 데이터 송수신

`artifacts` → 모델 로더: 모델/manifest. `config` → 로더: 선택 모델·알고리즘 설정. Convex → api → core → api → Convex: 추천 요청/결과.

## 설계 제약

서빙 프로세스는 artifacts를 읽기만 한다. 사용자 보고서·응답·일정을 저장하지 않는다. Convex가 접근 가능한 주소를 M0에서 확인한다.

## Design Pattern 힌트

**Composition Root**: 모델과 설정을 시작 시 주입한다. 실행 중 학습이나 임의 파일 경로 로드는 허용하지 않는다.
