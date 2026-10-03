# 아이 상태를 반영한 질문 입력

실제 Jinja2로 `질문 생성 지침 + 아이 상태 문서 + 추천 칼럼`을 렌더링한다.

| 템플릿 | 역할 |
|---|---|
| `templates/instructions.jinja` | system 메시지: 질문 생성 목적·출력 형식·관찰 질문 제약 |
| `templates/child_state.jinja` | 아이 상태: config의 Q 순서에 맞춘 척도명·검사 수치·미제공 표시 |
| `templates/scale_reference.jinja` | 제공 보고서의 척도 정의·종류별 기준·미제공 항목 안내 |
| `templates/input.jinja` | user 메시지: 아이 상태 문서와 추천 칼럼 제목·본문 조합 |

아이 상태는 보고서 수령 시점의 검사 수치다. 나이·생활 관찰·최근 변화는 현재 입력에 없으므로 추측하지 않는다. 점수에서 임상 해석이나 진단을 생성하도록 요구하지 않는다. 이름·보호자 ID·보고서 ID는 프롬프트로 전송하지 않는다.

## 척도 참고 정보

`scale_reference.json`은 사용자가 제공한 보고서의 척도 설명을 보존한다. 현재 Q 6개의 정의·소속·관찰 맥락을 검사 수치 옆에 렌더링한다. 종합척도(63T)와 개별 증후군(70T) 기준, 사회능력의 낮은 점수 방향을 구분한다. 이는 제공 보고서에 적힌 기준이며 별도 검증한 표준 규준으로 취급하지 않는다. 백분위를 임의 계산하거나 점수에 임상 판정 라벨을 자동 부여하지 않는다.

현재 Q에 없는 외현화·신체증상·사고의 문제·비행·공격성·사회능력·특수척도는 정의만 제공하고 점수와 실시 여부는 미제공으로 표시한다. 가상 사례의 나이·점수·보호자 의견·미실시 사실을 다른 아이에게 고정 적용하지 않는다.

제공 사례를 Q 순서로 표현하면 `[66, 58, 61, 63, 62, 60]`이다. 총 문제 정상 범위라는 이유만으로 다른 영역을 무시하지 않으며, T=63이 내재화와 우울/불안에서 다른 범위라는 점을 구분한다.

## 실행 흐름

1. 기존 Python 서비스(`npm run ranker`)가 인증된 `POST /question-input`에서 Jinja 템플릿을 렌더링한다. `StrictUndefined`로 누락 변수를 검출하며 본문에 들어 있는 Jinja 구문은 다시 실행하지 않는다.
2. Convex `workflows/process.run`이 보고서의 Q로 칼럼을 추천한다.
3. live 모드에서는 선정된 각 칼럼과 Q를 `generateQuestion(column, {q})`에 전달한다. 이 함수는 렌더링된 system/user 메시지로 OpenRouter LLM을 호출한다. `RANKER_URL`, `RANKER_TOKEN`, `OPENROUTER_API_KEY`가 필요하다.
4. JSON 구조·내용 검증 후 질문을 `assessmentId + scheduleVersion + columnId` 범위의 `validated`로 저장하고 해당 아이의 예약에 즉시 연결한다. 아이별 질문은 공통 캐시로 재사용하지 않는다.
5. `validated`는 자동 형식·내용 검증 결과이며 사람의 검토(`reviewed`)와 구분한다. 생성 실패 시에만 기존 검수 공통 질문을 사용한다. 다른 아이의 질문과 이전 일정 버전은 노출하지 않는다.

mock 모드는 외부 호출 없이 기존 검수 질문을 사용한다. 추천 시점에 질문 초안을 생성하므로 그 이후의 보호자 응답이나 상태 변화는 자동 반영되지 않는다. 실서비스 검수 UI는 후속 범위다.

## 요청 예시

```json
{
  "q": [65, 50, 55, 60, 45, null],
  "column": {
    "title": "친구와 어울리기 어려워하는 아이",
    "body": "아이의 또래 관계를 일상 장면에서 살펴보는 방법…"
  },
  "repair": false
}
```

응답은 `promptVersion: question-child-state-v2`과 `messages: [{role: system, content: …}, {role: user, content: …}]`다. 템플릿 변경 시 `PROMPT_VERSION`도 갱신한다.
