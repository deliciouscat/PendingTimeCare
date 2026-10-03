# Markdown 칼럼 로딩·렌더링·추천

`columns/*.md`가 칼럼 원본이다. 기존 `columns.json`은 보존하지만 실행·학습·테스트에서 읽지 않는다. 원본 Markdown 파일은 수정하지 않는다.

## 로딩

- 파일의 첫 `#` 제목을 카드 제목으로 사용하고, 그 아래 Markdown을 화면 본문으로 저장한다.
- 파일명으로 안정적인 ID를 만들고, 원문 SHA-256으로 콘텐츠 버전을 계산한다.
- Markdown AST에서 제목·문단·소제목·목록·표의 텍스트를 추출해 `rerankText`로 저장한다. 목록 항목은 줄바꿈으로 구분하며 HTML과 링크 URL은 모델 입력에서 제외한다.
- `column-metadata.ts`에는 본문과 별도로 합성 학습용 주제 rubric, 명시적인 mock feature, 검토된 공통 관찰 질문을 둔다. 새 파일의 기본 주제는 general이고 mock feature는 중립 값이다. 이 메타데이터는 임상 relevance label이나 실제 모델 출력이 아니다.

## 컴포넌트 간 데이터 교환

```text
columns/*.md + column-metadata.ts
  → load-columns.ts (body: Markdown, rerankText: 일반 텍스트)
  → export-columns.ts → columns.generated.ts
  → Convex prepare action
      → rerankText → OpenRouter Jev / rerank / 질문 생성
      → 원문·추출 텍스트·feature·초안 → preparation cache / columns DB
  → body → GraphQL → ColumnMarkdown → 보호자 화면
  → rerankText + Q/N/M → Python ranker → LambdaMART + BM25/MMR
```

Convex는 로컬 파일 시스템을 읽지 않으므로 시작 전에 생성하는 TypeScript 모듈로 콘텐츠를 전달한다. 이 모듈은 Git에서 제외하며 직접 편집하지 않는다. Python 단독 학습도 같은 Node loader를 호출해 원본 Markdown을 읽는다. JSON은 프로세스 간 snapshot과 모델 산출물에만 사용한다.

## 렌더링·일관성

`react-markdown`과 `remark-gfm`으로 소제목·목록·강조·인용·표·링크를 렌더링한다. HTML 실행은 허용하지 않고 위험한 URL은 기본 URL 검증으로 차단한다. `25~48개월` 같은 범위가 취소선으로 바뀌지 않도록 단일 물결표 취소선은 비활성화한다. 제목은 화면에서 한 번만 렌더링한다.

Markdown·메타데이터·모델 설정이 바뀌면 preparation cache key와 모델 경로가 바뀐다. DB seed 시 삭제되거나 이전 JSON에만 있던 칼럼은 archived로 처리해 새 추천에서 제외한다. 문서 수정 후 `npm run demo`를 재시작하면 콘텐츠 준비와 필요한 재학습을 수행한다. `npm run content:prepare`는 생성 모듈만 갱신한다.

패턴 힌트: Markdown loader는 Repository/Adapter, 외부 모델은 Provider Adapter, 준비 데이터는 Cache-Aside, 생성 모듈은 빌드 단계의 snapshot이다.

## 검증과 한계

원문 보존·텍스트 추출·버전 변경·범위 표기·안전한 HTML 렌더링을 테스트한다. 실제 3개 칼럼으로 OpenRouter Jev·reranker·질문 생성 호출과 모델 재학습을 확인했다. 합성 보고서 20건과 3개 칼럼으로 pair는 60개이며, 생성 질문은 승인 전 draft로 유지한다. 후보 3개에서 K=3이면 선택 집합이 같으므로 과거 6개 합성 칼럼의 다양성 개선 수치를 현재 결과에 적용하지 않는다.
