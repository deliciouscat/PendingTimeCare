import {internalAction,internalQuery,internalMutation} from '../_generated/server';
import {internal} from '../_generated/api';
import {v} from 'convex/values';
import columns from '../../content/columns.generated';
import config from '../../config/poc.json';
import references from '../../content/references.json';
import {columnFeatures,generateQuestion,JEV_ENDPOINT,JEV_DEFAULT_MODEL,RERANK_ENDPOINT,rerankModel,type Column} from '../adapters/providers';
export const cached=internalQuery({args:{key:v.string()},handler:async(ctx,{key})=>(await ctx.db.query('preparations').withIndex('by_key',q=>q.eq('key',key)).unique())?.data??null});
export const store=internalMutation({args:{key:v.string(),data:v.any()},handler:async(ctx,args)=>{const old=await ctx.db.query('preparations').withIndex('by_key',q=>q.eq('key',args.key)).unique();if(!old)await ctx.db.insert('preparations',args)}});
export const run=internalAction({args:{},handler:async(ctx):Promise<any[]>=>{
 const mode=process.env.API_MODE??'auto';
 if(!['auto','mock','live'].includes(mode))throw new Error('INVALID_API_MODE');
 if(mode==='live'&&!process.env.OPENROUTER_API_KEY)throw new Error('MISSING_PROVIDER_KEY');
 const prepared=[];
 for(const column of columns){
  const modes={jev:mode!=='mock'&&!!process.env.OPENROUTER_API_KEY,reranker:mode!=='mock'&&!!process.env.OPENROUTER_API_KEY,question:mode!=='mock'&&!!process.env.OPENROUTER_API_KEY};
  const hashInput=JSON.stringify({column,config,references,modes,jevEndpoint:JEV_ENDPOINT,rerankEndpoint:RERANK_ENDPOINT,models:[process.env.JEV_MODEL||JEV_DEFAULT_MODEL,rerankModel(),process.env.QUESTION_MODEL||'openai/gpt-4o-mini']});
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(hashInput));const key=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
  const cached:any=await ctx.runQuery(internal.workflows.prepare.cached,{key});
  if(cached){prepared.push({...cached,events:cached.events.map((e:any)=>({...e,cacheHit:true})),...(cached.draft?{draft:{...cached.draft,event:{...cached.draft.event,cacheHit:true}}}:{})});continue}
  const f=await columnFeatures(column as Column);let draft:null|Awaited<ReturnType<typeof generateQuestion>>=null;let questionError:string|undefined;
  try{draft=await generateQuestion(column as Column)}catch{questionError='QUESTION_GENERATION_FAILED'}
  const featureModes=new Set(f.events.map(e=>e.mode));const sourceMode=featureModes.size===1?f.events[0].mode:'mixed';
  const data={...column,n:f.n,m:f.m,mockFeatures:{n:f.n,m:f.m},sourceMode,events:f.events,...(draft?{draft,draftVersion:`generated-${key.slice(0,12)}`}:{questionError}),cacheKey:key};
  await ctx.runMutation(internal.workflows.prepare.store,{key,data});prepared.push(data);
 }
 await ctx.runMutation(internal.admin.seed,{columns:prepared});return prepared;
}});
