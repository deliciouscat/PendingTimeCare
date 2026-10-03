import {internalMutation,internalAction} from '../_generated/server';
import {internal} from '../_generated/api';
import {v} from 'convex/values';
import {validateQuestion} from '../../contracts/validation';
export const claim=internalMutation({args:{scheduleId:v.id('scheduledMessages'),claimToken:v.string()},handler:async(ctx,{scheduleId,claimToken})=>{
 const m=await ctx.db.get(scheduleId);if(!m||m.status!=='pending'||m.scheduledAt>Date.now())return false;const a=await ctx.db.get(m.assessmentId);
 if(!a||a.scheduleVersion!==m.scheduleVersion||a.consultationAt<=Date.now()){await ctx.db.patch(scheduleId,{status:'cancelled'});return false;}
 await ctx.db.patch(scheduleId,{status:'processing',claimToken,leaseUntil:Date.now()+60000,attemptCount:m.attemptCount+1});return true;
}});
export const commit=internalMutation({args:{scheduleId:v.id('scheduledMessages'),claimToken:v.string()},handler:async(ctx,{scheduleId,claimToken})=>{
 const m=await ctx.db.get(scheduleId);if(!m||m.status!=='processing'||m.claimToken!==claimToken||!m.leaseUntil||m.leaseUntil<=Date.now())return false;const a=await ctx.db.get(m.assessmentId);
 if(!a||a.scheduleVersion!==m.scheduleVersion||a.consultationAt<=Date.now()){await ctx.db.patch(scheduleId,{status:'cancelled'});return false;}
 if(m.columnId){const c=await ctx.db.query('columns').withIndex('by_column',q=>q.eq('columnId',m.columnId!)).unique();const question=m.questionId?await ctx.db.get(m.questionId):null;
  try{if(c?.status!=='published'||question?.status!=='reviewed')throw new Error('CONTENT_NOT_READY');validateQuestion(question.question)}catch{
   const delay=m.attemptCount===1?10000:30000;const status=m.attemptCount>=3?'failed':'pending';await ctx.db.patch(m._id,{status,scheduledAt:Date.now()+delay,errorCode:'CONTENT_NOT_READY'});if(status==='pending')await ctx.scheduler.runAfter(delay,internal.workflows.delivery.deliver,{scheduleId});return false;
  }
 }
 await ctx.db.patch(scheduleId,{status:'sent',sentAt:Date.now()});return true;
}});
export const deliver=internalAction({args:{scheduleId:v.id('scheduledMessages')},handler:async(ctx,{scheduleId})=>{const claimToken=crypto.randomUUID();const claimed=await ctx.runMutation(internal.workflows.delivery.claim,{scheduleId,claimToken});if(claimed)await ctx.runMutation(internal.workflows.delivery.commit,{scheduleId,claimToken})}});
export const recover=internalMutation({args:{},handler:async ctx=>{for(const m of await ctx.db.query('scheduledMessages').withIndex('by_status',q=>q.eq('status','processing')).collect()){if(m.leaseUntil&&m.leaseUntil<=Date.now()){const status=m.attemptCount>=3?'failed':'pending';await ctx.db.patch(m._id,{status});if(status==='pending')await ctx.scheduler.runAfter(0,internal.workflows.delivery.deliver,{scheduleId:m._id});}}}});
