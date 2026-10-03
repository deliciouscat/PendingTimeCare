import {test,expect} from '@playwright/test';
import {initialProgress} from '../../contracts/preparation';

test('completed stages stay checked while later stages are still running',async({page})=>{
 const now=Date.now();
 const assessment={id:'progress-test',status:'processing',receivedAt:now,consultationAt:now+86400000,demo:true,fallbackReason:null,progress:{...initialProgress(),catalog:'done',ranking:'done',questions:'loading',selectedColumnCount:3,questionTotal:3,questionCompleted:1}};
 await page.route('**/api/graphql',async route=>{
  const {query}=route.request().postDataJSON();
  const data=query.includes('careTimeline')?{assessments:[assessment],careTimeline:[]}:query.includes('assessments')?{assessments:[assessment]}:query.includes('samples')?{samples:[]}:{me:{email:'progress@example.test'}};
  await route.fulfill({json:{data}});
 });
 await page.goto('/');
 const tree=page.getByRole('region',{name:'콘텐츠 준비 과정',exact:true});
 const step=(title:string)=>tree.locator('.tree-step').filter({hasText:title});
 await expect(tree).toHaveAttribute('aria-busy','true');
 await expect(step('Markdown 칼럼 불러오기')).toHaveClass(/tree-step-done/);
 await expect(step('관련도·다양성으로 칼럼 선택')).toHaveClass(/tree-step-done/);
 await expect(step('아이 상태·칼럼 기반 질문 초안 준비')).toHaveClass(/tree-step-loading/);
 await expect(step('검증된 질문 연결')).toHaveClass(/tree-step-idle/);
 await expect(tree.getByText('질문 1/3개 처리',{exact:true})).toBeVisible();
 await page.screenshot({path:'.runtime/preparation-progress-desktop.png',fullPage:true});
 Object.assign(assessment.progress,{questions:'done',questionCompleted:3,linking:'done',scheduling:'loading'});
 await expect(step('아이 상태·칼럼 기반 질문 초안 준비')).toHaveClass(/tree-step-done/);
 await expect(step('검증된 질문 연결')).toHaveClass(/tree-step-done/);
 await expect(tree.locator('.tree-finish')).toHaveClass(/tree-finish-loading/);
 await expect(tree).toHaveAttribute('aria-busy','true');
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'.runtime/preparation-progress-mobile.png',fullPage:true});
 Object.assign(assessment,{status:'ready'});
 Object.assign(assessment.progress,{scheduling:'done'});
 await expect(tree.locator('.tree-finish')).toHaveClass(/tree-finish-done/);
 await expect(tree).toHaveAttribute('aria-busy','false');
});
