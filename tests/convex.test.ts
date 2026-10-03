/// <reference types="vite/client" />
import {convexTest} from 'convex-test';
import {describe,it,expect,vi,afterEach} from 'vitest';
import schema from '../convex/schema';
import {api,internal} from '../convex/_generated/api';
import {loadColumns} from '../content/load-columns';
const columns=await loadColumns();
const modules=import.meta.glob('../convex/**/*.{ts,js}');
afterEach(()=>vi.useRealTimers());
async function setup(){
 const t=convexTest(schema,modules);
 await t.mutation(internal.admin.seed,{columns:columns.map(c=>({...c,n:c.mockFeatures.n,m:c.mockFeatures.m,events:[]}))});
 const ids=await t.run(async ctx=>{
  const assessmentId=await ctx.db.insert('assessments',{guardianId:'guardian-1',q:[65,50,55,60,45,null],receivedAt:Date.now()-1000,consultationAt:Date.now()+86400000,timezone:'Asia/Seoul',featureSchemaVersion:'v1',demo:false,status:'ready',scheduleVersion:1,requestKey:'test-key-1',inputHash:'test'});
  const question=await ctx.db.query('questions').filter(q=>q.eq(q.field('columnId'),columns[0].id)).first();
  const messageId=await ctx.db.insert('scheduledMessages',{assessmentId,scheduleVersion:1,kind:'column',slotIndex:0,scheduledAt:Date.now()-1,status:'pending',attemptCount:0,columnId:columns[0].id,questionId:question!._id,withGlossary:false});
  return{assessmentId,messageId,questionId:question!._id};
 });
 return{t,...ids};
}
describe('Convex ownership and exposure',()=>{
 it('hides pending content and rejects another guardian reads/writes',async()=>{
  const {t,assessmentId,messageId,questionId}=await setup();
  await expect(t.withIdentity({subject:'guardian-1'}).query(api.care.item,{id:messageId})).rejects.toThrow('NOT_AVAILABLE');
  const other=t.withIdentity({subject:'guardian-2'});
  await expect(other.query(api.assessments.get,{id:assessmentId})).rejects.toThrow('FORBIDDEN');
  await expect(other.query(api.care.timeline,{assessmentId})).rejects.toThrow('FORBIDDEN');
  await expect(other.mutation(api.care.respond,{messageId,questionId,optionId:'option-1',skipped:false})).rejects.toThrow('FORBIDDEN');
 });
 it('saves once, validates option and restores same response',async()=>{
  const {t,messageId,questionId}=await setup();
  await t.mutation(internal.workflows.delivery.claim,{scheduleId:messageId,claimToken:'lease-1'});
  await t.mutation(internal.workflows.delivery.commit,{scheduleId:messageId,claimToken:'lease-1'});
  const owner=t.withIdentity({subject:'guardian-1'});
  await expect(owner.mutation(api.care.respond,{messageId,questionId,optionId:'wrong',skipped:false})).rejects.toThrow('INVALID_INPUT');
  const payload={messageId,questionId,optionId:'option-1',freeText:'생활 장면 기록',skipped:false};
  const a=await owner.mutation(api.care.respond,payload),b=await owner.mutation(api.care.respond,payload);expect(a.id).toBe(b.id);
  const item=await owner.query(api.care.item,{id:messageId});expect(item.response?.freeText).toBe(payload.freeText);
  expect(Object.keys(item)).not.toContain('score');expect(Object.keys(item)).not.toContain('m');
 });
});
describe('delivery concurrency and recovery',()=>{
 it('allows only one claim, validates claim token and blocks old schedules',async()=>{
  const {t,messageId,assessmentId}=await setup();
  const claims=await Promise.all(['a','b'].map(claimToken=>t.mutation(internal.workflows.delivery.claim,{scheduleId:messageId,claimToken})));expect(claims.filter(Boolean)).toHaveLength(1);
  expect(await t.mutation(internal.workflows.delivery.commit,{scheduleId:messageId,claimToken:'unknown'})).toBe(false);
  await t.mutation(internal.admin.invalidate,{assessmentId});
  expect(await t.mutation(internal.workflows.delivery.commit,{scheduleId:messageId,claimToken:claims[0]?'a':'b'})).toBe(false);
  const stored=await t.run(ctx=>ctx.db.get(messageId));expect(stored?.status).toBe('cancelled');
 });
 it('recovers expired leases and fences the previous worker',async()=>{
  vi.useFakeTimers();const {t,messageId}=await setup();
  await t.mutation(internal.workflows.delivery.claim,{scheduleId:messageId,claimToken:'old'});
  vi.setSystemTime(Date.now()+61000);
  expect(await t.mutation(internal.workflows.delivery.commit,{scheduleId:messageId,claimToken:'old'})).toBe(false);
  await t.mutation(internal.workflows.delivery.recover,{});
  expect(await t.mutation(internal.workflows.delivery.claim,{scheduleId:messageId,claimToken:'new'})).toBe(true);
  expect(await t.mutation(internal.workflows.delivery.commit,{scheduleId:messageId,claimToken:'old'})).toBe(false);
  expect(await t.mutation(internal.workflows.delivery.commit,{scheduleId:messageId,claimToken:'new'})).toBe(true);
 });
 it('blocks consultation-past and unreviewed question deliveries',async()=>{
  const {t,messageId,assessmentId,questionId}=await setup();
  await t.run(ctx=>ctx.db.patch(questionId,{status:'draft'}));
  await t.mutation(internal.workflows.delivery.claim,{scheduleId:messageId,claimToken:'a'});
  expect(await t.mutation(internal.workflows.delivery.commit,{scheduleId:messageId,claimToken:'a'})).toBe(false);
  await t.run(async ctx=>{await ctx.db.patch(assessmentId,{consultationAt:Date.now()-1});await ctx.db.patch(messageId,{scheduledAt:Date.now()-1})});
  expect(await t.mutation(internal.workflows.delivery.claim,{scheduleId:messageId,claimToken:'b'})).toBe(false);
  expect((await t.run(ctx=>ctx.db.get(messageId)))?.status).toBe('cancelled');
 });
});

describe('assessment-scoped personalized questions',()=>{
 it('connects validated personal questions immediately and keeps assessment isolation',async()=>{
  const t=convexTest(schema,modules);
  await t.mutation(internal.admin.seed,{columns:columns.map(c=>({...c,n:c.mockFeatures.n,m:c.mockFeatures.m,events:[]}))});
  const make=async(guardianId:string)=>t.run(ctx=>ctx.db.insert('assessments',{guardianId,q:[65,50,55,60,45,null],receivedAt:Date.now(),consultationAt:Date.now()+6*86400000,timezone:'Asia/Seoul',featureSchemaVersion:'v1',demo:false,status:'processing',scheduleVersion:1,requestKey:guardianId,inputHash:guardianId}));
  const a=await make('guardian-a'),b=await make('guardian-b');
  const ranked=[{columnId:columns[0].id,rank:1,score:0.9}];
  const draft={columnId:columns[0].id,question:{...columns[0].fallbackQuestion,questionPrompt:'아이와 함께 놀이할 때 규칙을 듣고 참여하는 모습은 어떤가요?'},event:{model:'test-llm'},promptVersion:'question-child-state-v2'};
  const args={assessmentId:a,scheduleVersion:1,ranked,modelVersion:'test',algorithmVersion:'test',questionDrafts:[draft]};
  await t.mutation(internal.workflows.process.finish,args);
  await t.mutation(internal.workflows.process.finish,args);
  const personal=await t.run(async ctx=>(await ctx.db.query('questions').collect()).filter(q=>q.assessmentId===a));
  expect(personal).toHaveLength(1);expect(personal[0].status).toBe('validated');
  let messages=await t.run(ctx=>ctx.db.query('scheduledMessages').collect());
  const original=messages.find(m=>m.assessmentId===a&&m.columnId===columns[0].id)!;
  expect(original.questionId).toBe(personal[0]._id);
  await t.run(ctx=>ctx.db.patch(original._id,{scheduledAt:Date.now()-1}));
  expect(await t.mutation(internal.workflows.delivery.claim,{scheduleId:original._id,claimToken:'personal'})).toBe(true);
  expect(await t.mutation(internal.workflows.delivery.commit,{scheduleId:original._id,claimToken:'personal'})).toBe(true);
  const owner=t.withIdentity({subject:'guardian-a'});
  const displayed=await owner.query(api.care.item,{id:original._id});
  expect(displayed.question?.questionPrompt).toBe(draft.question.questionPrompt);
  expect(displayed.question?.questionPrompt).not.toBe(columns[0].fallbackQuestion.questionPrompt);
  await expect(owner.mutation(api.care.respond,{messageId:original._id,questionId:personal[0]._id,optionId:draft.question.options[0].id,skipped:false})).resolves.toHaveProperty('saved',true);
  await t.mutation(internal.admin.reviewQuestion,{questionId:personal[0]._id,reviewer:'tester',decision:'reviewed'});
  // A reviewed personal question must never become another assessment's common question.
  await t.mutation(internal.workflows.process.finish,{assessmentId:b,scheduleVersion:1,ranked,modelVersion:'test',algorithmVersion:'test'});
  messages=await t.run(ctx=>ctx.db.query('scheduledMessages').collect());
  const own=messages.find(m=>m.assessmentId===a&&m.columnId===columns[0].id)!;
  const other=messages.find(m=>m.assessmentId===b&&m.columnId===columns[0].id)!;
  expect(own.questionId).toBe(personal[0]._id);expect(other.questionId).not.toBe(personal[0]._id);
  await t.run(ctx=>ctx.db.patch(other._id,{status:'sent',questionId:personal[0]._id}));
  await expect(t.withIdentity({subject:'guardian-b'}).query(api.care.item,{id:other._id})).rejects.toThrow('NOT_AVAILABLE');
  await t.run(ctx=>ctx.db.patch(personal[0]._id,{status:'rejected'}));
  await expect(owner.query(api.care.item,{id:original._id})).rejects.toThrow('NOT_AVAILABLE');
 });
 it('repairs unanswered common cards while preserving answered cards',async()=>{
  const {t,assessmentId,messageId,questionId}=await setup();
  const ids=await t.run(async ctx=>{
   const personal=await ctx.db.insert('questions',{assessmentId,scheduleVersion:1,columnId:columns[0].id,version:'older-personal',question:{...columns[0].fallbackQuestion,questionPrompt:'함께 놀이하는 동안 아이는 어떤 모습을 보였나요?'},status:'draft',model:'llm',promptVersion:'question-child-state-v2'});
   await ctx.db.patch(messageId,{status:'sent'});
   const answered=await ctx.db.insert('scheduledMessages',{assessmentId,scheduleVersion:1,kind:'column',slotIndex:1,scheduledAt:Date.now()-1,status:'sent',attemptCount:1,columnId:columns[0].id,questionId,withGlossary:false});
   await ctx.db.insert('responses',{guardianId:'guardian-1',assessmentId,messageId:answered,questionId,optionId:'option-1',skipped:false,submittedAt:Date.now()});
   return {personal,answered};
  });
  expect(await t.mutation(internal.admin.repairPersonalizedQuestions,{assessmentId})).toEqual({validated:1,linked:1});
  expect((await t.run(ctx=>ctx.db.get(messageId)))?.questionId).toBe(ids.personal);
  expect((await t.run(ctx=>ctx.db.get(ids.answered)))?.questionId).toBe(questionId);
  expect(await t.mutation(internal.admin.repairPersonalizedQuestions,{assessmentId})).toEqual({validated:0,linked:0});
 });
 it('runs recommendation then generates a question with the report scores and selected column',async()=>{
  vi.stubEnv('API_MODE','live');vi.stubEnv('OPENROUTER_API_KEY','router');vi.stubEnv('RANKER_URL','http://ranker');vi.stubEnv('RANKER_TOKEN','test-token');
  try{
   const t=convexTest(schema,modules);
   await t.mutation(internal.admin.seed,{columns:columns.slice(0,1).map(c=>({...c,n:c.mockFeatures.n,m:c.mockFeatures.m,events:[]}))});
   const q=[65,50,55,60,45,null];
   const assessmentId=await t.run(ctx=>ctx.db.insert('assessments',{guardianId:'guardian-1',q,receivedAt:Date.now(),consultationAt:Date.now()+6*86400000,timezone:'Asia/Seoul',featureSchemaVersion:'v1',demo:false,status:'processing',scheduleVersion:1,requestKey:'action-test',inputHash:'test'}));
   const calls:string[]=[];
   vi.stubGlobal('fetch',vi.fn(async(url:string,init:any)=>{
    calls.push(url);const input=JSON.parse(init.body);
    if(url.endsWith('/rank'))return Response.json({requestId:assessmentId,sourceMode:'live',modelVersion:'test',algorithmVersion:'test',items:[{columnId:columns[0].id,rank:1,score:0.9}]});
    if(url.endsWith('/question-input')){expect(input.q).toEqual(q);expect(input.column.title).toBe(columns[0].title);return Response.json({promptVersion:'question-child-state-v2',messages:[{role:'system',content:'지침'},{role:'user',content:'상태와 칼럼'}]})}
    expect(input.messages[1].content).toBe('상태와 칼럼');return Response.json({choices:[{message:{content:JSON.stringify(columns[0].fallbackQuestion)}}]});
   }));
   await t.action(internal.workflows.process.run,{assessmentId});
   expect(calls).toEqual(['http://ranker/rank','http://ranker/question-input','https://openrouter.ai/api/v1/chat/completions']);
   const personal=await t.run(async ctx=>(await ctx.db.query('questions').collect()).find(x=>x.assessmentId===assessmentId));
   expect(personal?.status).toBe('validated');expect(personal?.promptVersion).toBe('question-child-state-v2');
  }finally{vi.unstubAllEnvs();vi.unstubAllGlobals()}
 });
});

describe('individual preparation progress',()=>{
 it('publishes completed retrieval before question generation and persists linking before scheduling',async()=>{
  vi.stubEnv('API_MODE','live');vi.stubEnv('OPENROUTER_API_KEY','router');vi.stubEnv('RANKER_URL','http://ranker');vi.stubEnv('RANKER_TOKEN','token');
  let releaseRank!:()=>void,releasePrompt!:()=>void;
  const rankGate=new Promise<void>(resolve=>{releaseRank=resolve});
  const promptGate=new Promise<void>(resolve=>{releasePrompt=resolve});
  try{
   const t=convexTest(schema,modules);
   await t.mutation(internal.admin.seed,{columns:columns.slice(0,1).map(c=>({...c,n:c.mockFeatures.n,m:c.mockFeatures.m,events:[]}))});
   const assessmentId=await t.run(ctx=>ctx.db.insert('assessments',{guardianId:'progress-owner',q:[65,50,55,60,45,null],receivedAt:Date.now(),consultationAt:Date.now()+6*86400000,timezone:'Asia/Seoul',featureSchemaVersion:'v1',demo:false,status:'processing',scheduleVersion:1,requestKey:'progress-test',inputHash:'test'}));
   vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
    if(url.endsWith('/rank')){await rankGate;return Response.json({requestId:assessmentId,sourceMode:'live',modelVersion:'test',algorithmVersion:'test',items:[{columnId:columns[0].id,rank:1,score:0.9}]})}
    if(url.endsWith('/question-input')){await promptGate;return Response.json({promptVersion:'question-child-state-v2',messages:[{role:'system',content:'지침'},{role:'user',content:'상태와 칼럼'}]})}
    return Response.json({choices:[{message:{content:JSON.stringify(columns[0].fallbackQuestion)}}]});
   }));
   const action=t.action(internal.workflows.process.run,{assessmentId});
   const owner=t.withIdentity({subject:'progress-owner'});
   await vi.waitFor(async()=>{
    const a=await owner.query(api.assessments.get,{id:assessmentId});
    expect(a.status).toBe('processing');expect(a.progress?.catalog).toBe('done');expect(a.progress?.ranking).toBe('loading');expect(a.progress?.questions).toBe('idle');
   });
   releaseRank();
   await vi.waitFor(async()=>{
    const a=await owner.query(api.assessments.get,{id:assessmentId});
    expect(a.status).toBe('processing');expect(a.progress?.ranking).toBe('done');expect(a.progress?.questions).toBe('loading');expect(a.progress?.scheduling).toBe('idle');
   });
   releasePrompt();await action;
   const done=await owner.query(api.assessments.get,{id:assessmentId});
   expect(done.status).toBe('ready');expect(done.progress).toMatchObject({catalog:'done',ranking:'done',questions:'done',linking:'done',scheduling:'done',questionCompleted:1,questionFailed:0});
  }finally{releaseRank();releasePrompt();vi.unstubAllEnvs();vi.unstubAllGlobals()}
 });
 it('separates link commit from scheduling and ignores stale progress writes',async()=>{
  const t=convexTest(schema,modules);
  await t.mutation(internal.admin.seed,{columns:columns.slice(0,1).map(c=>({...c,n:c.mockFeatures.n,m:c.mockFeatures.m,events:[]}))});
  const assessmentId=await t.run(ctx=>ctx.db.insert('assessments',{guardianId:'progress-owner',q:[65,50,55,60,45,null],receivedAt:Date.now(),consultationAt:Date.now()+6*86400000,timezone:'Asia/Seoul',featureSchemaVersion:'v1',demo:false,status:'processing',scheduleVersion:1,requestKey:'link-test',inputHash:'test'}));
  const advance={assessmentId,scheduleVersion:1,step:'catalog' as const,state:'done' as const};
  expect(await t.mutation(internal.workflows.process.advance,advance)).toBe(true);
  expect(await t.mutation(internal.workflows.process.advance,{...advance,state:'loading'})).toBe(false);
  expect(await t.mutation(internal.workflows.process.advance,{...advance,scheduleVersion:0,step:'questions'})).toBe(false);
  const args={assessmentId,scheduleVersion:1,ranked:[{columnId:columns[0].id,rank:1,score:.9}],modelVersion:'test',algorithmVersion:'test'};
  const linked=await t.mutation(internal.workflows.process.link,args);
  let a=await t.run(ctx=>ctx.db.get(assessmentId));
  expect(a?.status).toBe('processing');expect(a?.progress?.linking).toBe('done');expect(a?.progress?.scheduling).toBe('loading');
  expect(await t.run(ctx=>ctx.db.query('scheduledMessages').collect())).toHaveLength(0);
  await t.mutation(internal.workflows.process.finish,{...args,linked:linked!});
  a=await t.run(ctx=>ctx.db.get(assessmentId));expect(a?.progress?.scheduling).toBe('done');
  expect(await t.mutation(internal.workflows.process.advance,{...advance,step:'ranking',state:'loading'})).toBe(false);
 });
});
