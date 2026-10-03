import {internalAction,internalQuery,internalMutation} from '../_generated/server';
import {internal} from '../_generated/api';
import {v} from 'convex/values';
import {planSchedule} from './schedule';
export const input=internalQuery({args:{assessmentId:v.id('assessments')},handler:async(ctx,{assessmentId})=>{const assessment=await ctx.db.get(assessmentId);const columns=(await ctx.db.query('columns').collect()).filter(c=>c.status==='published');return{assessment,columns}}});
export const finish=internalMutation({args:{assessmentId:v.id('assessments'),scheduleVersion:v.number(),ranked:v.array(v.any()),modelVersion:v.string(),algorithmVersion:v.string(),fallbackReason:v.optional(v.string())},handler:async(ctx,args)=>{
 const a=await ctx.db.get(args.assessmentId);if(!a||a.status!=='processing'||a.scheduleVersion!==args.scheduleVersion)return;
 const existing=await ctx.db.query('scheduledMessages').withIndex('by_assessment',q=>q.eq('assessmentId',a._id)).collect();if(existing.length)return;
 const valid=[];
 for(const r of args.ranked){const column=await ctx.db.query('columns').withIndex('by_column',q=>q.eq('columnId',r.columnId)).unique();if(!column||column.status!=='published')continue;const questions=await ctx.db.query('questions').withIndex('by_column',q=>q.eq('columnId',r.columnId)).collect();const question=questions.find(q=>q.status==='reviewed'&&q.version===column.questionDraftVersion)??questions.find(q=>q.status==='reviewed'&&q.version==='fallback-v1');if(question)valid.push({r,question});}
 const slots=planSchedule(a.receivedAt,a.consultationAt,Date.now(),valid.length,a.demo);let ci=0;
 for(const [index,slot] of slots.entries()){
  const candidate=slot.kind==='column'?valid[ci++]:null;
  const message={assessmentId:a._id,scheduleVersion:a.scheduleVersion,slotIndex:index,kind:slot.kind,scheduledAt:slot.scheduledAt,status:'pending',attemptCount:0,withGlossary:slot.withGlossary,...(candidate?{columnId:candidate.r.columnId,questionId:candidate.question._id}:{})};
  const id=await ctx.db.insert('scheduledMessages',message);await ctx.scheduler.runAt(slot.scheduledAt,internal.workflows.delivery.deliver,{scheduleId:id});
 }
 for(const c of valid)await ctx.db.insert('recommendations',{assessmentId:a._id,columnId:c.r.columnId,rank:c.r.rank,score:c.r.score,modelVersion:args.modelVersion,algorithmVersion:args.algorithmVersion});
 await ctx.db.patch(a._id,{status:args.fallbackReason?'degraded':slots.length?'ready':'failed',...(args.fallbackReason?{fallbackReason:args.fallbackReason}:{})});
}});
export const run=internalAction({args:{assessmentId:v.id('assessments')},handler:async(ctx,{assessmentId})=>{
 const {assessment:a,columns}=await ctx.runQuery(internal.workflows.process.input,{assessmentId});if(!a||a.status!=='processing')return;
 const k=planSchedule(a.receivedAt,a.consultationAt,Date.now(),columns.length,a.demo).filter(s=>s.kind==='column').length;
 let ranked:any[],modelVersion:string,algorithmVersion:string,fallbackReason:string|undefined;
 try{
  const response=await fetch(`${process.env.RANKER_URL}/rank`,{method:'POST',headers:{Authorization:`Bearer ${process.env.RANKER_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({requestId:assessmentId,featureSchemaVersion:'v1',referenceSetVersion:'refs-v1',taxonomyVersion:'topics-v1',q:a.q,candidates:columns.map(c=>({id:c.columnId,body:c.rerankText??c.body,n:c.n,m:c.m})),k}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('RANKER_UNAVAILABLE');const value=await response.json();
  if(value.requestId!==assessmentId||!Array.isArray(value.items)||value.items.length!==Math.min(k,columns.length)||new Set(value.items.map((x:any)=>x.columnId)).size!==value.items.length||value.items.some((r:any)=>!columns.some(c=>c.columnId===r.columnId)||!Number.isFinite(r.score)))throw new Error('INVALID_RANK_RESULT');
  ranked=value.items;modelVersion=value.modelVersion;algorithmVersion=value.algorithmVersion;
  if(value.sourceMode!=='live')fallbackReason='MOCK_FEATURE_PROVIDER';
 }catch{const common=columns.find(c=>c.topic==='learning')??columns[0];ranked=common?[{columnId:common.columnId,rank:1,score:0}]:[];modelVersion='reviewed-default';algorithmVersion='default-v1';fallbackReason='RANKER_UNAVAILABLE'}
 await ctx.runMutation(internal.workflows.process.finish,{assessmentId,scheduleVersion:a.scheduleVersion,ranked,modelVersion,algorithmVersion,...(fallbackReason?{fallbackReason}:{})});
}});
