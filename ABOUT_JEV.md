# ABOUT_JEV.md

> 바이브코딩(AI 보조 개발) 시 Jev를 연동·활용하기 위한 참고 문서.
> 아맘때 CBCL 과제 PoC(칼럼 추천·상담유형 분류) 맥락에 맞춰 정리했습니다.

---

## 0. 이 프로젝트에서 Jev가 하는 일

기획안(`기획안.md`, `기획안_training_pipeline.md`) 기준 Jev 역할:

| 용도 | 설명 |
|---|---|
| **상담유형 feature** | CBCL 보고서 → ADHD, 내재화, 위축 등 **M개 독립 Noul** (유형별 P(relevant), multi-label) |
| **Reranker feature** | LambdaMART 입력 feature N+M개 중 M개를 Jev가 생성 |
| **Confidence routing** | 확신도 높음 → 자동 추천, 낮음 → LLM/휴먼 review (선택) |

Jev는 **장문 생성·진단·처방**이 아니라 **구조화된 semantic judgment**만 담당합니다.

---

## 1. 한 줄 정의

**Jev**는 TypeSafe가 2026년 9월 15일 공개한 **System One Model**입니다.

- 텍스트를 생성하지 않음
- unstructured `state` → typed probabilistic `decision`을 **single parallel pass**로 반환
- LLM(System 2)과 달리 빠르고 직관적인 **System 1** 역할

네이밍:
- **System One**: Kahneman의 System 1/2 구분
- **Jev**: 경제학자 William Stanley Jevons — Jevons Paradox(비용↓ → 호출량↑) 가설

---

## 2. 핵심 개념

### 입출력

```
state + questions → typed decision + probability
```

자유 텍스트 생성 후 JSON parse가 **아님**. answer space가 schema로 **사전 정의**됨.

### Question primitive 3종

| 타입 | 용도 | 출력 예 |
|---|---|---|
| **Choice** | 범주형 분류 | `{ choice: "billing", probabilities: {...} }` |
| **Score** | 순서형 척도 | `{ score: 2.0, legend: [...] }` — 1.4는 "1과 2 사이 분산" |
| **Noul** | Yes/No 명제 | `{ noul: 0.87 }` — P(True) |

### 설계 철학

- **Atomic decomposition**: 큰 질문 1개보다 작고 독립적인 판단 여러 개 → 최종 결합은 **deterministic code**
- **semantic if statement** 비유: `if jev.noul > 0.8: route_to_billing()`
- 질문 간 확률은 **독립** — `supports`/`contradicts`를 따로 물으면 합이 1이 될 보장 없음

### 아키텍처 (vendor claim)

- Transformer LLM과 다른 architecture + parallel sampler
- 학습: **RLCD** (Reinforcement Learning for Calibrated Decisions)
  - RLHF: 사람 선호 / RLVR: 검증 가능 정답 / **RLCD: calibrated probability**
  - reward function 등 상세 recipe는 **미공개**

---

## 3. 스펙 / 가격 / 접근

| 항목 | 내용 |
|---|---|
| 가격 | 입력 $0.042 / 1M tokens, **output 무료** |
| Latency | 70~500ms (end-to-end) |
| Context | 최대 64k, **text input only** |
| Rate limit | 1200 req/min, 250k tokens/sec (direct API, 변경 가능) |
| 접근 | early access (waitlist) |
| Endpoint | `POST https://api.typesafe.ai/v1/systemone` |
| 모델 | `jev-latest` (alias) 또는 **`jev-1.13.0`** (pin 권장) |
| SDK | Python `typesafe-sdk`, JS `@typesafe-ai/sdk`, Rust `jev-sdk` |

### 라우팅 옵션 (PoC용)

| Route | base_url | API Key | model |
|---|---|---|---|
| TypeSafe (직접) | `https://api.typesafe.ai` | `TYPESAFE_API_KEY` | `jev-1.13.0` |
| OpenRouter | `https://openrouter.ai/api` | `OPENROUTER_API_KEY` | `typesafe/jev-latest` 또는 `~typesafe/jev-latest` |
| Vercel AI Gateway | `https://ai-gateway.vercel.sh/typesafe` | `AI_GATEWAY_API_KEY` | `typesafe-ai/jev` |


---

## 4. API 요청/응답 스키마

### 상담유형 질문 설계 (이 프로젝트)

**Choice 1개(`primary_concern`)가 아니라, 유형마다 Noul 1개씩 — 총 M개.**

| | 독립 Noul M개 (채택) | Choice 1개 |
|---|---|---|
| 질문 | "ADHD 칼럼이 도움 되는가?" × M | "가장 두드러지는 하나는?" |
| 확률 | 질문마다 독립, **합 ≠ 1**, 공존 가능 | 옵션 분포, **합 ≈ 1**, 배타적 |
| Reranker | multi-label feature vector | softmax형 feature (정보 손실) |

CBCL은 내재화+주의력 등 **동시 elevated**가 흔하므로, LambdaMART 입력에는 독립 Noul이 맞습니다.

### HTTP 요청

```bash
curl --fail-with-body https://api.typesafe.ai/v1/systemone \
  -H "Authorization: Bearer $TYPESAFE_API_KEY" \
  -H "Content-Type: application/json" \
  -d @request.json
```

```json
{
  "model": "jev-1.13.0",
  "state": "CBCL 보고서 텍스트 또는 구조화된 JSON",
  "questions": {
    "rel_adhd": {
      "type": "noul",
      "instructions": "이 CBCL 패턴을 보고 ADHD/주의력·과잉행동 관련 칼럼 추천에 활용할 수 있는가?"
    },
    "rel_borderline_iq": {
      "type": "noul",
      "instructions": "경계선 지능 관련 칼럼 추천에 활용할 수 있는가?"
    },
    "rel_internalizing": {
      "type": "noul",
      "instructions": "내재화 문제(우울·불안·위축 등) 관련 칼럼 추천에 활용할 수 있는가?"
    },
    "rel_depression_anxiety": {
      "type": "noul",
      "instructions": "우울/불안 관련 칼럼 추천에 활용할 수 있는가?"
    },
    "rel_social_immaturity": {
      "type": "noul",
      "instructions": "사회적 미성숙 관련 칼럼 추천에 활용할 수 있는가?"
    },
    "rel_withdrawn": {
      "type": "noul",
      "instructions": "위축/退避 행동 관련 칼럼 추천에 활용할 수 있는가?"
    },
    "urgency": {
      "type": "score",
      "instructions": "보호자가 느낄 불안/긴급도는?",
      "criteria": [
        "참고 수준, 큰 걱정 없음",
        "약간 걱정, 상담 전까지 관찰",
        "상당한 불안, 빠른 안내 필요",
        "즉각적 reassurance 필요"
      ]
    }
  }
}
```

### 필드 규칙 (자주 틀리는 부분)

| 항목 | 올바른 형식 | 잘못된 형식 |
|---|---|---|
| Choice options | `criteria: { "key": "description" }` | `options: ["a", "b"]` |
| Score levels | `criteria: ["level0", "level1", ...]` | `levels: 5` |
| Question text | `instructions` (복수) | `instruction` (단수) |
| state | string, object, array 모두 가능 | — |

### 응답

```json
{
  "model": "jev-1.13.0",
  "answers": {
    "rel_adhd": { "type": "noul", "noul": 0.72 },
    "rel_borderline_iq": { "type": "noul", "noul": 0.08 },
    "rel_internalizing": { "type": "noul", "noul": 0.85 },
    "rel_depression_anxiety": { "type": "noul", "noul": 0.79 },
    "rel_social_immaturity": { "type": "noul", "noul": 0.31 },
    "rel_withdrawn": { "type": "noul", "noul": 0.67 },
    "urgency": {
      "type": "score",
      "score": 2.3,
      "legend": ["...", "...", "...", "..."],
      "probabilities": [...],
      "confidence": 0.45
    }
  },
  "usage": { "input_tokens": 1200, "output_tokens": 48 }
}
```

> `rel_internalizing=0.85`와 `rel_adhd=0.72`가 **동시에 높을 수 있음** — 독립 Noul의 정상 동작.

---

## 5. SDK 사용법 (바이브코딩 스니펫)

### Python (권장 — training pipeline과 동일)

```bash
pip install typesafe-sdk   # Python 3.10+
# mirror 이슈 시: pip install -i https://pypi.org/simple typesafe-sdk
```

```python
import os
from typesafe_sdk import Noul, Score, TypeSafeClient

# --- TypeSafe 직접 ---
client = TypeSafeClient(model="jev-1.13.0")

# --- OpenRouter (기획안: OpenRouter typesafe/jev) ---
client = TypeSafeClient(
    api_key=os.environ["OPENROUTER_API_KEY"],
    base_url="https://openrouter.ai/api",
    model="typesafe/jev-latest",
)

CBCL_REPORT = open("sample_report.txt").read()

# 기획안_training_pipeline.md taxonomy — 유형마다 독립 Noul 1개
CONSULTATION_TYPES = {
    "adhd": "ADHD/주의력·과잉행동",
    "borderline_iq": "경계선 지능",
    "internalizing": "내재화 문제 종합",
    "depression_anxiety": "우울/불안",
    "social_immaturity": "사회적 미성숙",
    "withdrawn": "위축",
}

response = client.system_one(
    state=CBCL_REPORT,
    questions={
        f"rel_{key}": Noul(
            instructions=(
                f"이 CBCL 보고서를 보고 '{desc}' 관련 칼럼 추천에 "
                "활용할 수 있는가? (진단이 아닌 콘텐츠 추천 관점)"
            )
        )
        for key, desc in CONSULTATION_TYPES.items()
    },
)

# Reranker feature: M개 독립 score (합이 1일 필요 없음)
features = {
    k.replace("rel_", ""): v.noul
    for k, v in response.nouls.items()
}
# 예: {"adhd": 0.72, "internalizing": 0.85, "withdrawn": 0.67, ...}
```

**팁**
- M개 Noul + urgency Score를 **한 번의 `system_one` 호출**에 batch (비용·latency 동일)
- 상담유형 feature는 `response.nouls`에서 `rel_*` 키만 추출
- Async: `AsyncTypeSafeClient` + `async with`

### TypeScript (Convex action 등)

```typescript
import { TypeSafeClient } from '@typesafe-ai/sdk';

const client = new TypeSafeClient({
  apiKey: process.env.TYPESAFE_API_KEY!,
  model: 'jev-1.13.0',
});

const CONSULTATION_TYPES: Record<string, string> = {
  adhd: 'ADHD/주의력·과잉행동',
  borderline_iq: '경계선 지능',
  internalizing: '내재화 문제 종합',
  depression_anxiety: '우울/불안',
  social_immaturity: '사회적 미성숙',
  withdrawn: '위축',
};

const result = await client.systemOne({
  state: cbclReportText,
  questions: Object.fromEntries(
    Object.entries(CONSULTATION_TYPES).map(([key, desc]) => [
      `rel_${key}`,
      {
        type: 'noul' as const,
        instructions: `이 CBCL 보고서를 보고 '${desc}' 관련 칼럼 추천에 활용할 수 있는가?`,
      },
    ]),
  ),
});

const features = Object.fromEntries(
  Object.keys(CONSULTATION_TYPES).map((key) => [
    key,
    result.answers[`rel_${key}`].noul,
  ]),
);
```

> Python은 `system_one`, JS는 `systemOne` — **이름 다름**.

### Vercel AI SDK (alternative)

```typescript
import { experimental_evaluate as evaluate } from 'ai';

const result = await evaluate({
  model: 'typesafe-ai/jev',
  state: cbclReportText,
  questions: {
    needsReassurance: {
      type: 'boolean',  // noul과 동일
      instructions: '보호자에게 즉각적 reassurance가 필요한가?',
    },
  },
});
```

---

## 6. 환경 변수 (.env 템플릿)

```bash
# TypeSafe 직접
TYPESAFE_API_KEY=ts_...

# OpenRouter (기획안 경로)
OPENROUTER_API_KEY=sk-or-...

# Vercel AI Gateway (선택)
AI_GATEWAY_API_KEY=...

# 모델 pin (선택, 기본 jev-latest)
TYPESAFE_DEFAULT_MODEL=jev-1.13.0
TYPESAFE_BASE_URL=https://api.typesafe.ai
```

**보안**: API key를 클라이언트 번들·GitHub 커밋에 넣지 않음. Convex action / serverless에서만 호출.

---

## 7. 이 프로젝트 연동 패턴

### 7.1 상담유형 feature 추출 → LambdaMART

```
CBCL 보고서
  → Jev: M개 Noul 질문 (유형별 관련도)
  → feature vector [rel_adhd, rel_internalizing, ...]
  → LambdaMART reranker input (Q + N + M features)
```

```python
def extract_jev_features(report: str, client: TypeSafeClient) -> dict[str, float]:
    """M개 독립 Noul → reranker feature dict. 확률 합은 1이 아님."""
    resp = client.system_one(
        state=report,
        questions={
            f"rel_{k}": Noul(
                instructions=f"이 CBCL 보고서를 보고 '{v}' 관련 칼럼 추천에 활용할 수 있는가?"
            )
            for k, v in CONSULTATION_TYPES.items()
        },
    )
    return {k.replace("rel_", ""): resp.nouls[k].noul for k in resp.nouls}
```

### 7.2 Confidence-threshold routing

```python
THRESHOLD_AUTO = 0.85
THRESHOLD_REVIEW = 0.50

def route_column_recommendation(confidence: float) -> str:
    if confidence >= THRESHOLD_AUTO:
        return "auto_send"
    if confidence >= THRESHOLD_REVIEW:
        return "llm_rerank"      # voyageai/rerank-3 등
    return "human_or_default"
```

### 7.3 Convex action에서 호출 (개략)

```typescript
// convex/actions/jevFeatures.ts
"use node";
import { action } from "../_generated/server";
import { TypeSafeClient } from "@typesafe-ai/sdk";

export const extractFeatures = action({
  args: { reportText: v.string() },
  handler: async (ctx, { reportText }) => {
    const client = new TypeSafeClient({ apiKey: process.env.TYPESAFE_API_KEY! });
    const result = await client.systemOne({ state: reportText, questions: { /* ... */ } });
    return result.answers;  // DB 저장 또는 reranker pipeline으로 전달
  },
});
```

### 7.4 Jev vs LLM 역할 분리

| 작업 | 모델 |
|---|---|
| 상담유형 관련도, urgency, spam/abuse | **Jev** |
| 칼럼 본문 생성, 질문 문장 다듬기 | LLM (Claude/GPT 등) |
| 최종 칼럼 순위 | LambdaMART + BM25 |
| 임상 해석·진단 | **금지** (상담사 영역) |

---

## 8. 성능 주장 (vendor-reported, 독립 검증 전)

TypeSafe 4-workflow benchmark (정답: GPT-6 Astra + Fable 평균):

| Model | Accuracy | Cost/case | Latency |
|---|---|---|---|
| Jev | 67.8% | $0.0004 | 0.4s |
| GPT-5.6 Terra | 67.9% | $0.0304 | 10.1s |
| GPT-5.6 Sol | 74.1% | $0.0836 | 23.3s |
| Claude Opus 5 | 73.1% | $0.1761 | 37.8s |

- 정확도: mid-tier LLM 수준, top 대비 5~6pt 낮음
- 비용·속도: **1~2 order of magnitude** 우위 (출처마다 40~400x)
- Structured output error: Jev 0% vs Opus 5.73% (vendor claim)

**PoC 비용 추정 예** (CBCL 1건, M=6 Noul 질문):
- state ~2k tokens × $0.042/1M ≈ **$0.00008/건**
- 대기 기간 3일 × 2건/일 ≈ **$0.0005/보호자** 수준

---

## 9. 적합 / 부적합 use case

### 적합

- 고객 문의 routing, spam/abuse 판단
- 검색 relevance, ranking feature
- Agent action 선택·검증, LLM output guardrail
- 대규모 map 연산 (수천만 row sentiment scoring)
- Confidence-threshold routing

### 부적합

- 장문 생성 (칼럼 원문, reassurance 메시지)
- 코드 생성
- 복잡한 multi-step reasoning
- **Rationale이 필요한 audit** (숫자만 반환)

---

## 10. 해석 시 주의 (바이브코딩 시 AI에게 명시할 것)

1. **"Zero hallucination" ≠ 정답 보장** — schema 밖 값은 못 만들지만 semantic 오류는 가능
2. **Calibration은 group-level** — 개별 prediction correctness 미보장
3. **질문 간 확률 독립** — Noul M개는 **합 ≠ 1**, 공존 가능. 배타적 라벨이 필요하면 `argmax` 등을 코드에서 적용
4. **Taxonomy 설계가 병목** — 유형 경계(내재화 vs 우울/불안 vs 위축)를 instructions로 명확히. 누락 유형 = feature hole
5. **Rationale 없음** — debugging·규제 audit 한계
6. **독립 벤치마크 부족** — "promising, not settled"로 기획안에 명시

### 임상 도메인 추가 제약 (과제)

- Jev 출력은 **추천 feature**이지 진단이 아님
- 보호자-facing 문구에 probability를 그대로 노출하지 않음
- "관련 있음/없음"이 아닌 **"이 주제 칼럼이 도움될 수 있음"** 프레이밍

---

## 11. 에러 처리

| HTTP | SDK Exception | 대응 |
|---|---|---|
| 401 | `TypeSafeAuthenticationError` | API key 확인, 재시도 X |
| 400 | `TypeSafeBadRequestError` | model명, question schema 수정 |
| 422 | `TypeSafeUnprocessableEntityError` | required field 누락 |
| 429 | `TypeSafeRateLimitError` | backoff (SDK 기본 retry 2회) |
| 529/5xx | `TypeSafeInternalServerError` | retry |

```python
from typesafe_sdk import RetryPolicy, TypeSafeClient

client = TypeSafeClient(
    model="jev-1.13.0",
    retry=RetryPolicy(max_retries=4, backoff_max=10.0),
)
```

---

## 12. 프로덕션 체크리스트

- [ ] 모델 pin: `jev-1.13.0` (threshold calibration 재현성)
- [ ] question schema를 코드/설정 파일로 버전 관리
- [ ] latency, usage, outcome 로깅 (민감 state 전문은 로그 X)
- [ ] CBCL 개인정보: state에 최소 필요 필드만 포함
- [ ] taxonomy 전 유형에 `rel_*` Noul 존재 + confidence routing 구현
- [ ] Jev 실패 시 fallback (default 칼럼 목록 또는 LLM-only)

---

## 13. Neuro-symbolic 확장 (향후)

Jev를 **probabilistic predicate generator**로 보고 KG/rule과 결합:

```
Jev: supports(claim, doc) → 0.82
Jev: contradicts(claim, doc) → 0.11
  → symbolic constraint / graph traversal
  → deterministic final decision
```

핵심: semantic judgment만 별도 모델 category로 분리, reasoning·생성은 LLM/code.

---

## 14. 참고 자료

| 자료 | URL |
|---|---|
| velog (sobit, 2026.9.22) | https://velog.io/@sobit/Jev |
| DataCamp 분석 | https://www.datacamp.com/blog/system-one-models-jev |
| TypeSafe 공식 블로그 | https://typesafe.ai/blog/introducing-system-one-models-and-jev |
| Jev API Manual | https://jevmanual.com/manual/api/ |
| Python SDK Guide | https://jevaiguide.com/guides/python/ |
| Vercel AI Gateway 연동 | https://vercel.com/changelog/ai-gateway-now-supports-typesafe-clients-and-http-api-for-jev |
| TypeSafe API docs | https://docs.typesafe.ai/api |

---

## 15. 바이브코딩 프롬프트 예시

AI 코딩 도구에 붙여넣을 때:

```
Jev(System One Model)를 사용한다.
- endpoint: POST /v1/systemone, model: jev-1.13.0
- 상담유형: Choice(primary_concern) 금지 → 유형마다 독립 Noul(rel_adhd, rel_internalizing, ...)
- M개 Noul + (선택) urgency Score를 한 state에 batch
- Noul 확률은 독립(multi-label), 합이 1일 필요 없음
- OpenRouter: base_url=https://openrouter.ai/api, model=typesafe/jev-latest
- CBCL은 진단이 아닌 칼럼 추천 feature로만 사용
- ABOUT_JEV.md 섹션 4·7 패턴 따르기
```
