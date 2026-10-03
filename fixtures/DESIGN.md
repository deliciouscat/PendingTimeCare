# fixtures

> 구현 전 설계 · 하루 PoC 범위는 [ROADMAP](../ROADMAP.md), 전체 연결은 [ARCHITECTURE](../ARCHITECTURE.md) 참고. 아래 컴포넌트는 구현 예정이다.

## 책임

재현 가능한 개발·테스트 입력의 상위 경계.

## 구성

`synthetic/` 공개 가능한 합성 사례.

## 데이터 송수신

fixtures → training/tests/scripts: 입력 데이터. tests는 원본을 수정하지 않고 파생 결과를 임시 경로에 저장한다.

## 설계 제약

실제 보고서나 hidden 자료를 복사하지 않는다. mock 공급자 결과는 provenance=mock으로 식별한다.

## Design Pattern 힌트

**Test Fixture / Test Data Builder**: 명시적인 사례와 seed를 재사용한다.
