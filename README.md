# PendingTimeCare PoC

상담 전 보호자에게 관련 칼럼과 생활 관찰 질문을 제공하는 PoC다. LambdaMART로 칼럼을 추천하고, BM25 기반 MMR로 다양성을 확보한다.

## 턴키 실행

필수 도구: Node.js 22+, Python 3.11+, uv. 첫 실행에는 인터넷 연결이 필요하다.

```sh
cp .env.example .env
# .env의 OPENROUTER_API_KEY 입력
npm run demo
```

OpenRouter 키 하나로 Jev·reranker·질문 생성 모델을 호출한다. 키가 없으면 mock 모드로 실행한다. 모델 등 선택 설정은 `.env.example`을 참고한다.

`npm run demo`가 의존성 설치, 로컬 Convex·인증 준비, 모델 학습, 추천 서버와 웹 실행을 자동으로 처리한다. [http://localhost:3000](http://localhost:3000)에 접속하고, 터미널에 표시되는 데모 계정으로 로그인한다. 종료는 `Ctrl+C`다. `.env`를 변경하면 다시 실행한다.
