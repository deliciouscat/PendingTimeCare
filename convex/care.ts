import {query,mutation} from './_generated/server';
import {v} from 'convex/values';
import {own} from './access';
import glossary from '../content/glossary.json';
import {validateQuestion} from '../contracts/validation';
export const timeline=query({args:{assessmentId:v.id('assessments')},handler:async(ctx,{assessmentId})=>{
 const assessment=await own(ctx,assessmentId);const messages=await ctx.db.query('scheduledMessages').withIndex('by_assessment',q=>q.eq('assessmentId',assessmentId)).collect();
 const results=[];
 for(const m of messages){
  if(m.scheduleVersion!==assessment.scheduleVersion||m.status==='cancelled')continue;
  const c=m.columnId?await ctx.db.query('columns').withIndex('by_column',q=>q.eq('columnId',m.columnId!)).unique():null;
  const response=await ctx.db.query('responses').withIndex('by_message',q=>q.eq('messageId',m._id)).unique();
  const question=m.questionId?await ctx.db.get(m.questionId):null;
  const visible=m.status==='sent'&&assessment.consultationAt>Date.now()&&(!m.columnId||(c?.status==='published'&&question?.status==='reviewed'));
  results.push({id:m._id,kind:m.kind,title:c?.title??glossary.title,scheduledAt:m.scheduledAt,status:visible?'sent':m.status==='sent'?'unavailable':m.status,withGlossary:m.withGlossary,answered:!!response&&!response.skipped,skipped:response?.skipped??false});
 }
 return results.sort((a,b)=>a.scheduledAt-b.scheduledAt);
}});
export const item=query({args:{id:v.id('scheduledMessages')},handler:async(ctx,{id})=>{
 const m=await ctx.db.get(id);if(!m)throw new Error('FORBIDDEN');const a=await own(ctx,m.assessmentId);
 if(m.status!=='sent'||m.scheduleVersion!==a.scheduleVersion||a.consultationAt<=Date.now())throw new Error('NOT_AVAILABLE');
 const c=m.columnId?await ctx.db.query('columns').withIndex('by_column',q=>q.eq('columnId',m.columnId!)).unique():null;
 const question=m.questionId?await ctx.db.get(m.questionId):null;
 if(m.columnId&&(!c||c.status!=='published'||!question||question.status!=='reviewed'))throw new Error('NOT_AVAILABLE');
 if(question)validateQuestion(question.question);
 const response=await ctx.db.query('responses').withIndex('by_message',q=>q.eq('messageId',id)).unique();
 return{id,assessmentId:m.assessmentId,title:c?.title??glossary.title,body:c?.body??glossary.body,question:question?{id:question._id,version:question.version,...question.question}:null,glossary:m.withGlossary?glossary:null,response:response?{optionId:response.optionId??null,freeText:response.freeText??'',skipped:response.skipped}:null,reviewScope:c?.review.scope??glossary.reviewScope};
}});
export const respond=mutation({args:{messageId:v.id('scheduledMessages'),questionId:v.id('questions'),optionId:v.optional(v.string()),freeText:v.optional(v.string()),skipped:v.boolean()},handler:async(ctx,args)=>{
 const m=await ctx.db.get(args.messageId);if(!m)throw new Error('FORBIDDEN');const a=await own(ctx,m.assessmentId);
 const question=await ctx.db.get(args.questionId);const c=m.columnId?await ctx.db.query('columns').withIndex('by_column',q=>q.eq('columnId',m.columnId!)).unique():null;
 if(m.status!=='sent'||m.scheduleVersion!==a.scheduleVersion||a.consultationAt<=Date.now()||m.questionId!==args.questionId||question?.status!=='reviewed'||c?.status!=='published')throw new Error('NOT_AVAILABLE');
 const q=validateQuestion(question.question);
 if((!args.skipped&&!q.options.some(o=>o.id===args.optionId))||(args.freeText?.length??0)>1000||(args.skipped&&(args.optionId||args.freeText)))throw new Error('INVALID_INPUT');
 const old=await ctx.db.query('responses').withIndex('by_message',q=>q.eq('messageId',args.messageId)).unique();
 if(old)return{id:old._id,saved:true};
 const id=await ctx.db.insert('responses',{...args,guardianId:a.guardianId,assessmentId:a._id,submittedAt:Date.now()});return{id,saved:true};
}});
