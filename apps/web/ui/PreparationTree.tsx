'use client';
import {useState} from 'react';
import {initialProgress,type PreparationProgress,type StepState} from '../../../contracts/preparation';

type Preparation={status:string;fallbackReason:string|null;progress?:PreparationProgress|null};
type TimelineItem={kind:string;title:string};
type State=StepState|'prior';
const labels:Record<State,string>={idle:'대기',loading:'진행 중',done:'완료',fallback:'기본 콘텐츠',failed:'확인 필요',prior:'사전 작업'};
function branchState(states:StepState[]):StepState{
 if(states.includes('failed'))return 'failed';
 if(states.every(s=>s==='idle'))return 'idle';
 if(states.some(s=>s==='idle'||s==='loading'))return 'loading';
 return states.includes('fallback')?'fallback':'done';
}
function Indicator({state}:{state:State}){
 return <span className={`tree-indicator tree-${state}`} aria-hidden="true">{state==='done'?'✓':state==='failed'?'!':state==='fallback'?'↪':state==='prior'?'↺':''}</span>;
}
function Step({title,state}:{title:string;state:State}){
 return <li className={`tree-step tree-step-${state}`}><Indicator state={state}/><span>{title}</span><small>{labels[state]}</small></li>;
}

export default function PreparationTree({preparation,items,creating=false}:{preparation?:Preparation;items:TimelineItem[];creating?:boolean}){
 const [expanded,setExpanded]=useState(true);
 const loading=creating||preparation?.status==='processing';
 const failed=!creating&&preparation?.status==='failed';
 const complete=!!preparation&&!loading&&!failed;
 const state:State=loading?'loading':failed?'failed':complete?'done':'idle';
 const columns=creating?[]:items.filter(t=>t.kind==='column');
 const legacy:PreparationProgress={...initialProgress(),catalog:state,ranking:complete&&preparation?.fallbackReason==='RANKER_UNAVAILABLE'?'fallback':state,questions:complete&&preparation?.fallbackReason==='PERSONALIZED_QUESTION_FAILED'?'fallback':state,linking:state,scheduling:state,selectedColumnCount:columns.length};
 const progress=creating?initialProgress():preparation?.progress??(loading?initialProgress():legacy);
 const retrieval=branchState([progress.catalog,progress.ranking]);
 const questionState=branchState([progress.questions,progress.linking]);
 return <section className="preparation-tree" aria-label="콘텐츠 준비 과정" aria-busy={loading}>
  <details className="tree-disclosure" open={expanded} onToggle={event=>setExpanded(event.currentTarget.open)}>
  <summary className="tree-heading"><span className="tree-heading-title">콘텐츠를 준비하는 과정</span><span className={`tree-status tree-status-${state}`} role="status">{loading?'칼럼과 질문을 연결하고 있어요':failed?'준비 상태를 확인해 주세요':complete?'상담 준비 완료':'시작을 기다리고 있어요'}</span><svg className="tree-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary>
  <div className="tree-content">
  <div className={`tree-root tree-root-${state}`}><Indicator state={state}/><strong>우리 아이를 위한 상담 준비</strong></div>
  <div className="tree-branches">
   <div className="tree-branch">
    <div className="tree-branch-title"><Indicator state={retrieval}/><h4>Retrieve <span>칼럼 찾기</span></h4></div>
    <ul className="tree-steps">
     <Step title="Markdown 칼럼 불러오기" state={progress.catalog}/>
     <Step title="관련도·다양성으로 칼럼 선택" state={progress.ranking}/>
    </ul>
    {['done','fallback'].includes(progress.ranking)&&progress.selectedColumnCount>0&&<p className="tree-result">{progress.selectedColumnCount}개 칼럼 {progress.ranking==='fallback'?'기본 자료 준비':'선택 완료'}</p>}
   </div>
   <div className="tree-branch">
    <div className="tree-branch-title"><Indicator state={questionState}/><h4>질문 생성 <span>관찰 질문 연결</span></h4></div>
    <ul className="tree-steps">
     <Step title="아이 상태·칼럼 기반 질문 초안 준비" state={progress.questions}/>
     <Step title="검증된 질문 연결" state={progress.linking}/>
    </ul>
    {progress.questions==='loading'&&progress.questionTotal>0&&<p className="tree-result">질문 {progress.questionCompleted}/{progress.questionTotal}개 처리</p>}
    {progress.questions==='fallback'&&<p className="tree-result">검토된 공통 질문 사용{progress.questionFailed>0?` · ${progress.questionFailed}개 생성 실패`:''}</p>}
    {progress.linking==='done'&&columns.length>0&&<p className="tree-result">{columns.length}개 관찰 질문 연결 완료</p>}
   </div>
  </div>
  <div className={`tree-finish tree-finish-${progress.scheduling}`}><Indicator state={progress.scheduling}/><span>칼럼과 질문을 시간선에 배치</span><small>{labels[progress.scheduling]}</small></div>
  <p className="tree-note">아이 상태와 칼럼에 맞춘 질문을 생성하고, 형식·내용 검증을 통과하면 연결합니다. 생성 실패 시에는 검토된 공통 질문을 사용합니다.</p>
  </div>
  </details>
 </section>;
}
