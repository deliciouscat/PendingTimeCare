# Jev를 OpenRouter로 호출하도록 수정

2026-10-03. 기존 Markdown 문서를 보존하며, README·IMPLEMENTATION의 TypeSafe 직접 호출 설명을 이 문서로 정정한다.

## 실행 설정

```dotenv
API_MODE=auto
OPENROUTER_API_KEY=your-openrouter-key
JEV_MODEL=~typesafe/jev-latest
VOYAGE_API_KEY=your-voyage-key
RERANK_MODEL=rerank-3
QUESTION_MODEL=openai/gpt-4o-mini
```

`npm run demo`를 재시작하면 적용된다. **별도 TypeSafe 키는 필요 없다.** `OPENROUTER_API_KEY` 하나로 Jev와 질문 생성 모델을 호출한다. Voyage reranker는 `VOYAGE_API_KEY`를 사용한다. auto 모드에서 Voyage 키가 없으면 N feature는 mock이며, 전체 feature 출처는 mixed로 표시한다. live 모드는 OpenRouter·Voyage 키를 모두 요구한다.

## API와 데이터 흐름

| 작업 | endpoint | 입력·출력 |
|---|---|---|
| Jev | `https://openrouter.ai/api/v1/systemone` | 칼럼 body와 Noul 질문 6개 → `answers`의 독립 확률 6개 |
| 질문 생성 | `https://openrouter.ai/api/v1/chat/completions` | 칼럼 body → 검증 후 draft 질문 |
| reranking feature | `https://api.voyageai.com/v1/rerank` | 칼럼 query·기준문서 3개 → 기준문서 순서의 점수 3개 |

OpenRouter는 Decisions API와 TypeSafe 호환 System One API를 제공한다. 이번 수정은 기존 Noul 응답 계약을 유지하는 System One 경로를 사용한다. 모델 기본값은 `~typesafe/jev-latest`다. [공식 SDK·API 문서](https://openrouter.ai/docs/guides/community/typesafe-sdk), [모델 페이지](https://openrouter.ai/~typesafe/jev-latest).

컴포넌트 흐름은 `.env → scripts/dev.mjs → Convex 환경 → workflows/prepare → providers → preparations cache → 학습 snapshot`이다. Jev endpoint와 모델을 cache key에 포함해 이전 직접 호출 결과와 구분한다. API 키 자체는 cache key에 넣지 않는다. 패턴 힌트: provider Adapter와 콘텐츠 preparation의 Cache-Aside.

## 검증 범위

HTTP fixture로 OpenRouter URL·Bearer 키·모델 ID·Noul 순서·확률 범위와 OpenRouter 키만 있을 때의 mixed 모드를 검증했다. 실제 유료 API 호출 성공은 아직 확인하지 않았다.
