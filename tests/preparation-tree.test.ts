import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import PreparationTree from '../apps/web/ui/PreparationTree';
import {initialProgress,type PreparationProgress} from '../contracts/preparation';

function render(progress:PreparationProgress,creating=false){
 return renderToStaticMarkup(createElement(PreparationTree,{preparation:{status:'processing',fallbackReason:null,progress},items:[],creating}));
}
function step(html:string,title:string){return html.split('</li>').find(part=>part.includes(title))!;}
describe('preparation tree reports individual completed stages',()=>{
 it('keeps retrieval completed while questions are still generating',()=>{
  const html=render({...initialProgress(),catalog:'done',ranking:'done',questions:'loading',selectedColumnCount:3,questionTotal:3,questionCompleted:1});
  expect(step(html,'Markdown 칼럼 불러오기')).toContain('tree-step-done');
  expect(step(html,'관련도·다양성으로 칼럼 선택')).toContain('tree-step-done');
  expect(step(html,'아이 상태·칼럼 기반 질문 초안 준비')).toContain('tree-step-loading');
  expect(step(html,'검증된 질문 연결')).toContain('tree-step-idle');
  expect(html).toContain('3개 칼럼 선택 완료');expect(html).toContain('질문 1/3개 처리');
  expect(html).toContain('tree-finish-idle');
 });
 it('shows a completed question generation while scheduling has not finished',()=>{
  const html=render({...initialProgress(),catalog:'done',ranking:'done',questions:'done',linking:'done',scheduling:'loading'});
  expect(step(html,'아이 상태·칼럼 기반 질문 초안 준비')).toContain('tree-step-done');
  expect(step(html,'검증된 질문 연결')).toContain('tree-step-done');
  expect(html).toContain('tree-finish-loading');
 });
 it('does not reuse the previous preparation progress while creating a new one',()=>{
  const html=render({...initialProgress(),catalog:'done',ranking:'done',questions:'done',linking:'done',scheduling:'done'},true);
  expect(step(html,'Markdown 칼럼 불러오기')).toContain('tree-step-loading');
  expect(step(html,'관련도·다양성으로 칼럼 선택')).toContain('tree-step-idle');
 });
});
