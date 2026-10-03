import {internalMutation,internalQuery} from './_generated/server';
import {v} from 'convex/values';
import {validateQuestion} from '../contracts/validation';
import {internal} from './_generated/api';
import {questionAvailable} from './questionAvailability';
export const seed=internalMutation({args:{columns:v.array(v.any())},handler:async(ctx,{columns})=>{
 const currentIds=new Set(columns.map(c=>c.id));
 for(const old of await ctx.db.query('columns').collect())if(!currentIds.has(old.columnId)&&old.status==='published')await ctx.db.patch(old._id,{status:'archived'});
 for(const c of columns){
  if(c.n.length!==3||c.m.length!==6||c.n.some((x:number)=>!Number.isFinite(x))||c.m.some((x:number)=>!Number.isFinite(x)||x<0||x>1))throw new Error('INVALID_FEATURE');
  const old=await ctx.db.query('columns').withIndex('by_column',q=>q.eq('columnId',c.id)).unique();
  const data={columnId:c.id,version:c.version,title:c.title,body:c.body,...(c.rerankText?{rerankText:c.rerankText}:{}),...(c.sourceFile?{sourceFile:c.sourceFile}:{}),topic:c.topic,status:c.status,review:c.review,n:c.n,m:c.m,featureVersion:c.cacheKey??'v1',events:c.events,...(c.draftVersion?{questionDraftVersion:c.draftVersion}:{})};
  if(old)await ctx.db.patch(old._id,data);else await ctx.db.insert('columns',data);
  const existing=await ctx.db.query('questions').withIndex('by_column',q=>q.eq('columnId',c.id)).collect();
  const fallback=validateQuestion(c.fallbackQuestion);
  if(!existing.some(q=>q.version==='fallback-v1'))await ctx.db.insert('questions',{columnId:c.id,version:'fallback-v1',question:fallback,status:'reviewed',model:'human-template-v1',promptVersion:'question-v1',review:c.review});
  if(c.draft&&!existing.some(q=>q.version===c.draftVersion))await ctx.db.insert('questions',{columnId:c.id,version:c.draftVersion,question:validateQuestion(c.draft.question),status:'draft',model:c.draft.event.model,promptVersion:'question-v1',event:c.draft.event});
 }
 return{columns:columns.length};
}});
export const invalidate=internalMutation({args:{assessmentId:v.id('assessments')},handler:async(ctx,{assessmentId})=>{const a=await ctx.db.get(assessmentId);if(!a)return;await ctx.db.patch(assessmentId,{scheduleVersion:a.scheduleVersion+1});for(const m of await ctx.db.query('scheduledMessages').withIndex('by_assessment',q=>q.eq('assessmentId',assessmentId)).collect())if(m.status!=='sent')await ctx.db.patch(m._id,{status:'cancelled'});}});
export const reviewQuestion=internalMutation({args:{questionId:v.id('questions'),reviewer:v.string(),decision:v.union(v.literal('reviewed'),v.literal('rejected'))},handler:async(ctx,args)=>{const q=await ctx.db.get(args.questionId);if(!q)throw new Error('NOT_FOUND');if(args.decision==='reviewed')validateQuestion(q.question);await ctx.db.patch(q._id,{status:args.decision,review:{scope:'developer-demo',reviewer:args.reviewer,reviewedAt:Date.now()}});
 if(args.decision==='reviewed'&&q.assessmentId){
  const a=await ctx.db.get(q.assessmentId);if(!a||a.scheduleVersion!==q.scheduleVersion||a.consultationAt<=Date.now())return;
  for(const m of await ctx.db.query('scheduledMessages').withIndex('by_assessment',x=>x.eq('assessmentId',q.assessmentId!)).collect()){
   if(m.columnId===q.columnId&&m.scheduleVersion===q.scheduleVersion&&m.status==='pending')await ctx.db.patch(m._id,{questionId:q._id});
  }
 }}});
export const inspect=internalQuery({args:{},handler:async ctx=>({columns:await ctx.db.query('columns').collect(),questions:await ctx.db.query('questions').collect(),messages:await ctx.db.query('scheduledMessages').collect()})});
/** Repair older schedules that linked common questions despite successful generation. */
export const repairPersonalizedQuestions=internalMutation({args:{assessmentId:v.optional(v.id('assessments'))},handler:async(ctx,args)=>{
 let validated=0,linked=0;
 for(const question of await ctx.db.query('questions').collect()){
  if(!question.assessmentId||args.assessmentId&&question.assessmentId!==args.assessmentId||question.promptVersion!=='question-child-state-v2'||!['draft','validated','reviewed'].includes(question.status))continue;
  const a=await ctx.db.get(question.assessmentId);
  if(!a||a.status==='processing'||a.scheduleVersion!==question.scheduleVersion||a.consultationAt<=Date.now())continue;
  const column=await ctx.db.query('columns').withIndex('by_column',q=>q.eq('columnId',question.columnId)).unique();
  if(column?.status!=='published')continue;
  try{validateQuestion(question.question)}catch{continue}
  if(question.status==='draft'){await ctx.db.patch(question._id,{status:'validated'});validated++;}
  const available={...question,status:question.status==='draft'?'validated':question.status};
  if(!questionAvailable(available,a,question.columnId))continue;
  for(const m of await ctx.db.query('scheduledMessages').withIndex('by_assessment',q=>q.eq('assessmentId',a._id)).collect()){
   if(m.columnId!==question.columnId||m.scheduleVersion!==a.scheduleVersion||!['pending','sent'].includes(m.status))continue;
   const response=await ctx.db.query('responses').withIndex('by_message',q=>q.eq('messageId',m._id)).unique();
   const current=m.questionId?await ctx.db.get(m.questionId):null;
   if(response||current?.assessmentId)continue;
   await ctx.db.patch(m._id,{questionId:question._id});linked++;
  }
 }
 return {validated,linked};
}});
