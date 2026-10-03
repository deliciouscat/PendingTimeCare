# OpenRouter 키 하나로 모든 모델 호출

2026-10-03. 기존 README·IMPLEMENTATION·OPENROUTER_UPDATE 문서를 보존한다. 이 문서는 이전 문서의 Voyage 직접 호출·별도 키 요구·mixed 모드 설명을 정정한다.

## 설정

```dotenv
API_MODE=auto
OPENROUTER_API_KEY=your-openrouter-key
JEV_MODEL=~typesafe/jev-latest
RERANK_MODEL=qwen/qwen3-reranker-8b
QUESTION_MODEL=openai/gpt-4o-mini
```

`.env` 저장 후 `npm run demo`를 재시작한다. TypeSafe·Voyage 별도 키는 필요 없다. OpenRouter 키가 있으면 세 모델을 호출하고, 없으면 auto 모드에서 모두 mock을 사용한다. live 모드는 OpenRouter 키를 요구한다. 질문 호출 실패 시에는 검토된 고정 질문을 사용하며, 생성 결과는 승인 전 draft로 유지한다.

Voyage 모델로 바꾸려면 다음과 같이 설정한다. 기존 `rerank-3` 같은 bare Voyage ID도 `voyageai/` 접두사를 붙여 처리한다.

```dotenv
RERANK_MODEL=voyageai/rerank-3
```

모델 제공 여부는 [Qwen 모델 페이지](https://openrouter.ai/qwen/qwen3-reranker-8b)와 [Voyage 모델 페이지](https://openrouter.ai/voyageai/rerank-3)에서 확인했다.

## 데이터 교환과 패턴 힌트

| 컴포넌트 | 교환 데이터 |
|---|---|
| startup → Convex 환경 | OpenRouter 키와 모델 ID; 별도 공급자 키는 전달하지 않음 |
| prepare action → reranker adapter | 후보 칼럼 body를 query, 고정 기준문서 3개를 documents로 전달 |
| adapter → OpenRouter `/api/v1/rerank` | model, query, documents, `top_n=3`; Bearer OpenRouter 키 |
| OpenRouter → adapter | `results`의 index·relevance_score와 usage |
| adapter → preparation cache → 학습·추론 | index 순서로 복원한 N feature 3개와 모델·호출 메타데이터 |

OpenRouter의 rerank 응답 형식에 맞춰 기존 `top_k`/`data`를 `top_n`/`results`로 변경했다. 응답의 누락·중복·범위 밖 index와 유효하지 않은 점수를 거부한다. endpoint와 정규화한 모델 ID를 cache key에 포함하므로 직접 API 결과나 다른 모델의 feature를 섞지 않는다. 모델을 바꾸면 새 snapshot과 모델 디렉터리를 준비한다. 패턴 힌트: provider Adapter, Cache-Aside.

N은 후보 칼럼별 기준문서 관련도이며, 보고서 추천 순위는 Q+N+M 기반 LambdaMART가 계산한다. BM25는 MMR의 칼럼 간 유사도에만 사용한다.

OpenRouter rerank 계약은 [공식 rerank API 문서](https://openrouter.ai/docs/api/api-reference/rerank/create-rerank)와 [공식 SDK 문서](https://openrouter.ai/docs/client-sdks/typescript/api-reference/rerank)를 참고했다.

## 검증

TypeScript·Convex·provider 테스트 19개와 타입 검사가 통과했다. HTTP fixture로 Qwen·Voyage·bare Voyage ID 선택, 동일 키 인증, N 순서 복원, 잘못된 응답 거부를 확인했다. 기존 Markdown 문서는 변경하지 않았다. 실제 유료 API 호출은 아직 미검증이다.
