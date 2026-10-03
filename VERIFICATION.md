# PoC 실행 검증 기록

2026-10-03, 로컬 개발 환경에서 확인했다. 기존 문서는 수정하지 않고 이 기록을 추가한다.

| 검증 | 결과 |
|---|---|
| 새로운 임시 checkout에서 `.env` 설정 후 `npm run demo` | 의존성 설치, 인증 준비, Convex 구성·배포, feature 준비, 학습, Python·웹 시작 성공 |
| 포트 설정 | `.env`의 `WEB_PORT=3100`, `RANKER_PORT=8100` 적용 확인 |
| 재시작 | 동일 설정의 6개 칼럼 feature cache hit, 기존 모델 재사용 확인 |
| 종료 | 데모 manager 종료 후 웹·Python·Convex의 listen 포트가 모두 닫힘 |
| TypeScript / Convex / provider adapter 테스트 | 12개 통과 |
| Python 학습·데이터 계약·추론 API 테스트 | 5개 통과 |
| 실제 로컬 서비스 브라우저 테스트 | 2개 통과: 예약·열람·응답·복원, 사용자 격리·멱등성 |
| 타입 검사 / 프로덕션 빌드 | 통과 |
| 기존 파일 보존 | 작업 시작 시 34개 파일의 SHA-256과 모두 일치 |
| `trainset/` | README와 schema/manifest template만 존재 |

첫 실행에서는 Convex backend의 HTTP 준비와 함수 배포 완료 시점이 달랐다. 시작 스크립트는 `.env.local` 생성과 함수 배포 완료를 함께 기다리도록 수정했다. CLI가 추가한 `.gitignore` 변경은 원래 내용으로 복원하며, 런타임·키 파일 제외는 checkout의 Git `info/exclude`에 적용한다.

## 모델 평가

독립 합성 보고서 20건과 칼럼 6개로 120개 pair를 구성했다. family 단위 train/validation/test는 12/4/4건이다. 별도 test 4건의 평균 결과:

| 모델 | NDCG@3 | 선택 칼럼 평균 유사도 |
|---|---:|---:|
| XGBRanker | 0.8750 | 0.7288 |
| XGBRanker + MMR | 0.9077 | 0.5999 |

BM25는 MMR의 칼럼 간 유사도에만 사용했다. 모델 입력은 Q+N+M 15개다. 합성 소규모 평가이므로 실제 추천 품질이나 임상 타당성을 증명하지 않는다.

## 검증하지 않은 항목

실제 외부 API key가 없어 TypeSafe·Voyage·OpenRouter 유료 호출은 수행하지 않았다. 실행 결과의 feature 출처는 `mock`이며, live adapter 테스트는 HTTP fixture를 사용했다. 키를 입력하면 해당 adapter를 사용하는 실행 경로가 구현돼 있지만 실제 계정별 모델 접근과 호출 성공은 별도 실행 확인이 필요하다.

임상 전문가 검수, 실제 푸시·메일 전달, 전체 재예약, 공개 배포·제출은 후속 범위다. 자동 생성 질문은 draft로 보관하고 승인 전에는 노출하지 않는다.
