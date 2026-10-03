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
