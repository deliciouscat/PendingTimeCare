import {mutation,query} from './_generated/server';
import {v} from 'convex/values';
import {internal} from './_generated/api';
import {guardian,own} from './access';
import {assessmentSchema} from '../contracts/validation';
export const create=mutation({args:{input:v.any(),idempotencyKey:v.string()},handler:async(ctx,args)=>{
 const user=await guardian(ctx);const parsed=assessmentSchema.safeParse(args.input);if(!parsed.success)throw new Error('INVALID_INPUT');const input=parsed.data;
 if(args.idempotencyKey.length<8||args.idempotencyKey.length>128||input.receivedAt>Date.now()+60000||input.consultationAt<=Date.now()||input.consultationAt>Date.now()+90*86400000)throw new Error('INVALID_INPUT');
 if(input.demo&&process.env.DEMO_ENABLED!=='true')throw new Error('INVALID_INPUT');
 const hash=JSON.stringify(input);const old=await ctx.db.query('assessments').withIndex('by_request',q=>q.eq('guardianId',user).eq('requestKey',args.idempotencyKey)).unique();
 if(old){if(old.inputHash!==hash)throw new Error('IDEMPOTENCY_CONFLICT');return{id:old._id,status:old.status}}
 const id=await ctx.db.insert('assessments',{...input,guardianId:user,status:'processing',scheduleVersion:1,requestKey:args.idempotencyKey,inputHash:hash});
 await ctx.scheduler.runAfter(0,internal.workflows.process.run,{assessmentId:id});return{id,status:'processing'};
}});
export const get=query({args:{id:v.id('assessments')},handler:async(ctx,{id})=>{const a=await own(ctx,id);return{id:a._id,status:a.status,consultationAt:a.consultationAt,receivedAt:a.receivedAt,demo:a.demo,fallbackReason:a.fallbackReason??null}}});
export const list=query({args:{},handler:async ctx=>{const user=await guardian(ctx);const rows=await ctx.db.query('assessments').withIndex('by_guardian',q=>q.eq('guardianId',user)).collect();return rows.map(a=>({id:a._id,status:a.status,consultationAt:a.consultationAt,receivedAt:a.receivedAt,demo:a.demo,fallbackReason:a.fallbackReason??null})).reverse()}});
