import {internalAction,internalQuery,internalMutation,type MutationCtx} from '../_generated/server';
import {internal} from '../_generated/api';
import type {Id} from '../_generated/dataModel';
import {v,type Infer} from 'convex/values';
import {stepState} from '../schema';
import {initialProgress,type PreparationStep} from '../../contracts/preparation';
import {planSchedule} from './schedule';
import {generateQuestion,ProviderError} from '../adapters/providers';
import {validateQuestion} from '../../contracts/validation';
import {questionAvailable} from '../questionAvailability';

const step=v.union(v.literal('catalog'),v.literal('ranking'),v.literal('questions'),v.literal('linking'),v.literal('scheduling'));
const processingArgs={assessmentId:v.id('assessments'),scheduleVersion:v.number(),ranked:v.array(v.any()),modelVersion:v.string(),algorithmVersion:v.string(),fallbackReason:v.optional(v.string()),questionDrafts:v.optional(v.array(v.object({columnId:v.string(),question:v.any(),event:v.any(),promptVersion:v.string()})))};
const inputValidator=v.object(processingArgs);
type ProcessInput=Infer<typeof inputValidator>;
type Linked={r:any;questionId:Id<'questions'>};

export const input=internalQuery({args:{assessmentId:v.id('assessments')},handler:async(ctx,{assessmentId})=>{
 const assessment=await ctx.db.get(assessmentId);
 const columns=(await ctx.db.query('columns').collect()).filter(c=>c.status==='published');
 return {assessment,columns};
}});
export const advance=internalMutation({args:{assessmentId:v.id('assessments'),scheduleVersion:v.number(),step,state:stepState,selectedColumnCount:v.optional(v.number()),questionTotal:v.optional(v.number()),questionCompleted:v.optional(v.number()),questionFailed:v.optional(v.number())},handler:async(ctx,args)=>{
 const a=await ctx.db.get(args.assessmentId);
 if(!a||a.status!=='processing'||a.scheduleVersion!==args.scheduleVersion)return false;
 const progress={...(a.progress??initialProgress())};
 // Ignore a late worker trying to regress an already completed stage.
 if(['done','fallback','failed'].includes(progress[args.step]))return false;
 progress[args.step]=args.state;
 for(const key of ['selectedColumnCount','questionTotal','questionCompleted','questionFailed'] as const){
  const value=args[key];if(value!==undefined){if(!Number.isInteger(value)||value<0)throw new Error('INVALID_PROGRESS');progress[key]=value;}
 }
 await ctx.db.patch(a._id,{progress,...(args.state==='failed'?{status:'failed'}:{})});
 return true;
}});

async function linkQuestions(ctx:MutationCtx,args:ProcessInput):Promise<Linked[]>{
 for(const draft of args.questionDrafts??[]){
  if(!args.ranked.some(r=>r.columnId===draft.columnId))continue;
  const version=`${draft.promptVersion}-${args.assessmentId}-${args.scheduleVersion}`;
  const existing=await ctx.db.query('questions').withIndex('by_column',q=>q.eq('columnId',draft.columnId)).collect();
  if(existing.some(q=>q.assessmentId===args.assessmentId&&q.version===version))continue;
  await ctx.db.insert('questions',{assessmentId:args.assessmentId,scheduleVersion:args.scheduleVersion,columnId:draft.columnId,version,question:validateQuestion(draft.question),status:'validated',model:draft.event.model,promptVersion:draft.promptVersion,event:draft.event});
 }
 const valid:Linked[]=[];
 const assessment=await ctx.db.get(args.assessmentId);
 if(!assessment)return valid;
 for(const r of args.ranked){
  const column=await ctx.db.query('columns').withIndex('by_column',q=>q.eq('columnId',r.columnId)).unique();
  if(!column||column.status!=='published')continue;
  const questions=(await ctx.db.query('questions').withIndex('by_column',q=>q.eq('columnId',r.columnId)).collect()).filter(q=>questionAvailable(q,assessment,r.columnId));
  const question=questions.find(q=>q.assessmentId===args.assessmentId)??questions.find(q=>!q.assessmentId&&q.version===column.questionDraftVersion)??questions.find(q=>!q.assessmentId&&q.version==='fallback-v1');
  if(question){validateQuestion(question.question);valid.push({r,questionId:question._id});}
 }
 return valid;
}
export const link=internalMutation({args:processingArgs,handler:async(ctx,args):Promise<Linked[]|null>=>{
 const a=await ctx.db.get(args.assessmentId);
 if(!a||a.status!=='processing'||a.scheduleVersion!==args.scheduleVersion)return null;
 const valid=await linkQuestions(ctx,args);
 await ctx.db.patch(a._id,{progress:{...(a.progress??initialProgress()),linking:'done',scheduling:'loading'}});
 return valid;
}});
export const finish=internalMutation({args:{...processingArgs,linked:v.optional(v.array(v.object({r:v.any(),questionId:v.id('questions')})))},handler:async(ctx,args)=>{
 const a=await ctx.db.get(args.assessmentId);
 if(!a||a.status!=='processing'||a.scheduleVersion!==args.scheduleVersion)return;
 const existing=await ctx.db.query('scheduledMessages').withIndex('by_assessment',q=>q.eq('assessmentId',a._id)).collect();
 if(existing.length)return;
 const linked=args.linked??await linkQuestions(ctx,args);
 const valid:Linked[]=[];
 // Content/review may change between the linking and scheduling transactions.
 for(const candidate of linked){
  const column=await ctx.db.query('columns').withIndex('by_column',q=>q.eq('columnId',candidate.r.columnId)).unique();
  const question=await ctx.db.get(candidate.questionId);
  if(!args.ranked.some(r=>r.columnId===candidate.r.columnId)||column?.status!=='published'||!questionAvailable(question,a,candidate.r.columnId))continue;
  validateQuestion(question.question);valid.push(candidate);
 }
 const slots=planSchedule(a.receivedAt,a.consultationAt,Date.now(),valid.length,a.demo);let ci=0;
 for(const [index,slot] of slots.entries()){
  const candidate=slot.kind==='column'?valid[ci++]:null;
  const message={assessmentId:a._id,scheduleVersion:a.scheduleVersion,slotIndex:index,kind:slot.kind,scheduledAt:slot.scheduledAt,status:'pending',attemptCount:0,withGlossary:slot.withGlossary,...(candidate?{columnId:candidate.r.columnId,questionId:candidate.questionId}:{})};
  const id=await ctx.db.insert('scheduledMessages',message);
  await ctx.scheduler.runAt(slot.scheduledAt,internal.workflows.delivery.deliver,{scheduleId:id});
 }
 for(const c of valid)await ctx.db.insert('recommendations',{assessmentId:a._id,columnId:c.r.columnId,rank:c.r.rank,score:c.r.score,modelVersion:args.modelVersion,algorithmVersion:args.algorithmVersion});
 const previous=a.progress;
 const progress={...(previous??initialProgress()),catalog:'done' as const,ranking:previous?.ranking==='fallback'?'fallback' as const:'done' as const,questions:previous?.questions==='fallback'?'fallback' as const:'done' as const,linking:'done' as const,scheduling:slots.length?'done' as const:'failed' as const};
 await ctx.db.patch(a._id,{progress,status:!slots.length?'failed':args.fallbackReason?'degraded':'ready',...(args.fallbackReason?{fallbackReason:args.fallbackReason}:{})});
}});

export const run=internalAction({args:{assessmentId:v.id('assessments')},handler:async(ctx,{assessmentId})=>{
 const {assessment:a,columns}=await ctx.runQuery(internal.workflows.process.input,{assessmentId});
 if(!a||a.status!=='processing')return;
 const scheduleVersion=a.scheduleVersion;
 let activeStep:PreparationStep='catalog';
 try{
  await ctx.runMutation(internal.workflows.process.advance,{assessmentId,scheduleVersion,step:'catalog',state:'done'});
  activeStep='ranking';
  await ctx.runMutation(internal.workflows.process.advance,{assessmentId,scheduleVersion,step:'ranking',state:'loading'});
  const k=planSchedule(a.receivedAt,a.consultationAt,Date.now(),columns.length,a.demo).filter(s=>s.kind==='column').length;
  let ranked:any[],modelVersion:string,algorithmVersion:string,fallbackReason:string|undefined;
  try{
   const response=await fetch(`${process.env.RANKER_URL}/rank`,{method:'POST',headers:{Authorization:`Bearer ${process.env.RANKER_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({requestId:assessmentId,featureSchemaVersion:'v1',referenceSetVersion:'refs-v1',taxonomyVersion:'topics-v1',q:a.q,candidates:columns.map(c=>({id:c.columnId,body:c.rerankText??c.body,n:c.n,m:c.m})),k}),signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw new Error('RANKER_UNAVAILABLE');const value=await response.json();
   if(value.requestId!==assessmentId||!Array.isArray(value.items)||value.items.length!==Math.min(k,columns.length)||new Set(value.items.map((x:any)=>x.columnId)).size!==value.items.length||value.items.some((r:any)=>!columns.some(c=>c.columnId===r.columnId)||!Number.isFinite(r.score)))throw new Error('INVALID_RANK_RESULT');
   ranked=value.items;modelVersion=value.modelVersion;algorithmVersion=value.algorithmVersion;
   if(value.sourceMode!=='live')fallbackReason='MOCK_FEATURE_PROVIDER';
  }catch{const common=columns.find(c=>c.topic==='learning')??columns[0];ranked=common?[{columnId:common.columnId,rank:1,score:0}]:[];modelVersion='reviewed-default';algorithmVersion='default-v1';fallbackReason='RANKER_UNAVAILABLE';}
  await ctx.runMutation(internal.workflows.process.advance,{assessmentId,scheduleVersion,step:'ranking',state:fallbackReason==='RANKER_UNAVAILABLE'?'fallback':'done',selectedColumnCount:ranked.length});
  activeStep='questions';
  await ctx.runMutation(internal.workflows.process.advance,{assessmentId,scheduleVersion,step:'questions',state:'loading',questionTotal:ranked.length});
  const questionDrafts=[];let questionCompleted=0,questionFailed=0;
  const liveQuestions=(process.env.API_MODE??'auto')!=='mock'&&!!process.env.OPENROUTER_API_KEY;
  if(liveQuestions){
   for(const r of ranked){
    const c=columns.find(c=>c.columnId===r.columnId);
    try{
     if(!c)throw new Error('MISSING_COLUMN');
     const draft=await generateQuestion({title:c.title,body:c.body,rerankText:c.rerankText},{q:a.q});
     if(draft.event.mode==='live'&&draft.promptVersion)questionDrafts.push({columnId:c.columnId,question:draft.question,event:draft.event,promptVersion:draft.promptVersion});
    }catch(error){
     // Log only operational identifiers/codes, never child scores or LLM text.
     console.warn('PERSONALIZED_QUESTION_FAILED',{assessmentId,columnId:r.columnId,model:process.env.QUESTION_MODEL||'openai/gpt-4o-mini',code:error instanceof ProviderError?error.code:'QUESTION_GENERATION_ERROR'});
     questionFailed++;fallbackReason??='PERSONALIZED_QUESTION_FAILED';
    }
    questionCompleted++;
    await ctx.runMutation(internal.workflows.process.advance,{assessmentId,scheduleVersion,step:'questions',state:'loading',questionCompleted,questionFailed});
   }
  }
  await ctx.runMutation(internal.workflows.process.advance,{assessmentId,scheduleVersion,step:'questions',state:questionFailed||(!liveQuestions&&ranked.length)?'fallback':'done',questionCompleted,questionFailed});
  activeStep='linking';
  await ctx.runMutation(internal.workflows.process.advance,{assessmentId,scheduleVersion,step:'linking',state:'loading'});
  const args={assessmentId,scheduleVersion,ranked,modelVersion,algorithmVersion,questionDrafts,...(fallbackReason?{fallbackReason}:{})};
  const linked=await ctx.runMutation(internal.workflows.process.link,args);
  if(!linked)return;
  activeStep='scheduling';
  await ctx.runMutation(internal.workflows.process.finish,{...args,linked});
 }catch{
  await ctx.runMutation(internal.workflows.process.advance,{assessmentId,scheduleVersion,step:activeStep,state:'failed'});
 }
}});
