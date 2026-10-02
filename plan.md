```
AI 검사 결과 → **(보호자 수령, 평균 며칠 대기)** → 상담사 전화 상담 → 사후 관리
```
**보고서 수령 시점부터 상담 전까지** 관리


전문 용어 중심 보고서로 인한 이해 어려움
상담 전 대기 기간의 불안감 누적

보호자 만족도 저하
상담 이탈(No-show)
지원 문의 증가
서비스 신뢰 저하

AI는 자격이 없으므로 진단·처방 불가


# 리텐션 장치

간단한 과제를 주어 '부여된 진전 효과'(endowed progress effect)가 발휘되도록 한다.

- 상담 전 용어설명(하루 전)
- 유관사례에 대한 칼럼 + 아이에 대한 질문 (이틀 간격) → 이탈방지


# 구현

## 연동 서비스
- Convex 서버리스 함수
- Convex `runAfter/runAt` (GCP Pub/Sub 비슷한 것)

## 설계 요소

### 백엔드
#### Convex 관제서버
- 옵저버 패턴으로 trigger
- trigger가 작동되면 pending_message_list로부터 `pop()`으로 칼럼id과 질문을 반환받고 클라이언트에게 전송
- initial(보고서 수령) 시점에 할 일: Subscriber 등록 → 칼럼을 추천받아 `pending_message_list` 구성 → 각 list에 대해 async하게 질문 생성

#### AI 추론 서버
- 칼럼 추천: 유사 reranker를 만들어 컨텐츠 추천. (후술할 재귀적 방식으로)
- 질문 생성: 에이전트를 호출하는 구조

### 클라이언트
핵심이 아니므로 간단하게 구현

- 로그인
- 칼럼 게시물 영역
- 질문 영역: 3개의 선택지 + 자유응답칸

## 추천엔진

### LambdaMART Reranker 추천
Nummeric한 값의 rich함을 반영하려면 수치값을 토큰화시켜버리는 BERT나 LLM같은 모델로 추천을 하면 안된다.
임상 진단 기준이 cutoff 함수적인 성질이 있기 때문에 회귀모델보단 Tree-based 모델을 사용함이 맞다.

```
LambdaMART Reranker로 추천 → 추천된 문서와 BM25 점수가 낮은 문서로 다음 문서 추천 → 추천된 문서와 BM25 점수가 낮은 문서로 다음 문서 추천 → ...(예상 대기일/2 개의 칼럼을 미리 등록)...

score(d) = λ · LambdaMART(d | 보고서)  −  (1−λ) · max_{s ∈ 선택됨} sim(d, s)
```

- input: 
    Query: 검사결과 보고서의 각 수치값. Q개의 feature
    Document: N개의 `기준문서`와의 Reranker 유사도(N개 feature), Jev로 추출한 주요 상담유형 관련도 (M개 feature) → N+M개 feature
    모델의 Input에는 Q+N+M개의 feature가 들어간다.
- 학습 pair 구성: 실제 보고서를 기반으로 관련 문서 Retrieve. (실제 보고서가 포맷은 안맞지만 유사정답이니까)