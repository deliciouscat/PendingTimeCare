import {describe,it,expect,vi,afterEach} from 'vitest';
import {columnFeatures,generateQuestion,postJson,type Column} from '../convex/adapters/providers';
import {loadColumns} from '../content/load-columns';
const columns=await loadColumns();
import config from '../config/poc.json';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()});
describe('provider adapters selected from environment keys',()=>{
 it('uses real-protocol calls for configured keys and restores reference order',async()=>{
  vi.stubEnv('API_MODE','auto');vi.stubEnv('RERANK_MODEL','');vi.stubEnv('OPENROUTER_API_KEY','test-router');
  const calls:{url:string;payload:any;auth:string}[]=[];
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:any)=>{
   const payload=JSON.parse(init.body);calls.push({url,payload,auth:init.headers.Authorization});
   if(url.endsWith('/systemone'))return Response.json({answers:Object.fromEntries(config.consultationTypes.map(t=>[`rel_${t}`,{noul:0.8}])),usage:{input_tokens:100}});
   if(url.endsWith('/rerank'))return Response.json({results:[{index:2,relevance_score:0.3},{index:0,relevance_score:0.9},{index:1,relevance_score:0.1}],usage:{total_tokens:200}});
   return Response.json({choices:[{message:{content:JSON.stringify(columns[0].fallbackQuestion)}}],usage:{prompt_tokens:50,completion_tokens:20}});
  }));
  const f=await columnFeatures(columns[0] as Column);expect(f.n).toEqual([0.9,0.1,0.3]);expect(f.m.reduce((a,b)=>a+b,0)).toBeGreaterThan(1);expect(f.events.every(e=>e.mode==='live')).toBe(true);
  const q=await generateQuestion(columns[0] as Column);expect(q.status).toBe('draft');expect(q.event.mode).toBe('live');
  expect(calls.map(c=>c.auth)).toEqual(['Bearer test-router','Bearer test-router','Bearer test-router']);
  expect(calls[0].url).toBe('https://openrouter.ai/api/v1/systemone');expect(calls[0].payload.model).toBe('~typesafe/jev-latest');expect(calls[0].payload.state).toBe(columns[0].rerankText);expect(calls[1].url).toBe('https://openrouter.ai/api/v1/rerank');expect(calls[1].payload.model).toBe('qwen/qwen3-reranker-8b');expect(calls[1].payload.top_n).toBe(3);expect(calls[1].payload).not.toHaveProperty('top_k');expect(calls[1].payload.query).toBe(columns[0].rerankText);
  expect(calls[2].payload.messages[1].content).not.toContain('guardian');
 });
 it.each(['qwen/qwen3-reranker-8b','voyageai/rerank-3','rerank-3'])('one OpenRouter key supports reranker %s',async(model)=>{
  vi.stubEnv('API_MODE','live');vi.stubEnv('OPENROUTER_API_KEY','router-only');vi.stubEnv('RERANK_MODEL',model);
  const fetch=vi.fn(async(url:string,init:any)=>{
   expect(init.headers.Authorization).toBe('Bearer router-only');
   if(url.endsWith('/systemone'))return Response.json({answers:Object.fromEntries(config.consultationTypes.map(t=>[`rel_${t}`,{type:'noul',noul:0.8}]))});
   expect(url).toBe('https://openrouter.ai/api/v1/rerank');expect(JSON.parse(init.body).model).toBe(model==='rerank-3'?'voyageai/rerank-3':model);
   return Response.json({results:[{index:2,relevance_score:0.2},{index:0,relevance_score:0.9},{index:1,relevance_score:0.4}]});
  });vi.stubGlobal('fetch',fetch);
  const f=await columnFeatures(columns[0] as Column);expect(f.events.map(e=>e.mode)).toEqual(['live','live']);expect(f.n).toEqual([0.9,0.4,0.2]);expect(fetch).toHaveBeenCalledTimes(2);
 });
 it.each([
  [{index:0,relevance_score:0.9},{index:0,relevance_score:0.8},{index:2,relevance_score:0.7}],
  [{index:0,relevance_score:0.9},{index:1,relevance_score:0.8}],
  [{index:0,relevance_score:0.9},{index:1,relevance_score:0.8},{index:3,relevance_score:0.7}],
  [{index:0,relevance_score:0.9},{index:1,relevance_score:0.8},{index:2,relevance_score:'bad'}],
 ])('rejects invalid rerank results %#',async(...results)=>{
  vi.stubEnv('API_MODE','auto');vi.stubEnv('OPENROUTER_API_KEY','router');
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>Response.json(url.endsWith('/systemone')?{answers:Object.fromEntries(config.consultationTypes.map(t=>[`rel_${t}`,{noul:0.8}]))}:{results})));
  await expect(columnFeatures(columns[0] as Column)).rejects.toThrow(/INVALID_RERANK_ORDER|INVALID_PROVIDER_VECTOR/);
 });
 it('explicit mock makes no requests, missing key is rejected in live mode',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);vi.stubEnv('API_MODE','mock');
  const f=await columnFeatures(columns[0] as Column);expect(f.events.every(e=>e.mode==='mock')).toBe(true);expect(fetch).not.toHaveBeenCalled();
  vi.stubEnv('API_MODE','live');vi.stubEnv('OPENROUTER_API_KEY','');await expect(columnFeatures(columns[0] as Column)).rejects.toThrow('MISSING_PROVIDER_KEY');
 });
 it('does not retry authentication failures and rejects malformed probabilities',async()=>{
  const fetch=vi.fn(async()=>new Response('',{status:401}));vi.stubGlobal('fetch',fetch);
  await expect(postJson('https://provider.invalid','secret',{})).rejects.toThrow('PROVIDER_HTTP_401');expect(fetch).toHaveBeenCalledTimes(1);
  vi.stubEnv('API_MODE','auto');vi.stubEnv('OPENROUTER_API_KEY','test');vi.stubGlobal('fetch',vi.fn(async()=>Response.json({answers:{}})));
  await expect(columnFeatures(columns[0] as Column)).rejects.toThrow('INVALID_PROVIDER_VECTOR');
 });
});

describe('personalized Jinja question input',()=>{
 it('repairs truncated output with a larger token budget',async()=>{
  vi.stubEnv('API_MODE','live');vi.stubEnv('OPENROUTER_API_KEY','router');vi.stubEnv('RANKER_URL','http://ranker');vi.stubEnv('RANKER_TOKEN','secret');
  const budgets:number[]=[],repairs:boolean[]=[];
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:any)=>{
   const payload=JSON.parse(init.body);
   if(url.endsWith('/question-input')){repairs.push(payload.repair);return Response.json({promptVersion:'question-child-state-v2',messages:[{role:'system',content:'지침'},{role:'user',content:'상태와 칼럼'}]});}
   budgets.push(payload.max_tokens);
   return Response.json({choices:[{finish_reason:budgets.length===1?'length':'stop',message:{content:budgets.length===1?'{':JSON.stringify(columns[0].fallbackQuestion)}}]});
  }));
  await expect(generateQuestion(columns[0],{q:[50,50,50,50,50,50]})).resolves.toHaveProperty('promptVersion','question-child-state-v2');
  expect(budgets).toEqual([2000,4000]);expect(repairs).toEqual([false,true]);
 });
 it('identifies repeated output truncation separately from unsafe content',async()=>{
  vi.stubEnv('API_MODE','live');vi.stubEnv('OPENROUTER_API_KEY','router');
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({choices:[{finish_reason:'length',message:{content:'{'}}]})));
  await expect(generateQuestion(columns[0])).rejects.toThrow('QUESTION_OUTPUT_TRUNCATED');
 });
 it('sends child scores and column to renderer and forwards rendered messages to LLM',async()=>{
  vi.stubEnv('API_MODE','live');vi.stubEnv('OPENROUTER_API_KEY','router');vi.stubEnv('RANKER_URL','http://ranker');vi.stubEnv('RANKER_TOKEN','ranker-secret');
  const q=[65,50,55,60,45,null];
  const messages=[{role:'system',content:'질문 생성 지침'},{role:'user',content:'아이 상태: 주의집중 65 / 칼럼: 또래 관계'}];
  const fetch=vi.fn(async(url:string,init:any)=>{
   const data=JSON.parse(init.body);
   if(url==='http://ranker/question-input'){
    expect(init.headers.Authorization).toBe('Bearer ranker-secret');expect(data.q).toEqual(q);
    expect(data.column).toEqual({title:columns[0].title,body:columns[0].rerankText});expect(data).not.toHaveProperty('assessmentId');
    return Response.json({promptVersion:'question-child-state-v2',messages});
   }
   expect(data.messages).toEqual(messages);expect(init.headers.Authorization).toBe('Bearer router');
   return Response.json({choices:[{message:{content:JSON.stringify(columns[0].fallbackQuestion)}}]});
  });vi.stubGlobal('fetch',fetch);
  const result=await generateQuestion(columns[0] as Column,{q});
  expect(result.promptVersion).toBe('question-child-state-v2');expect(result.status).toBe('draft');expect(fetch).toHaveBeenCalledTimes(2);
 });
 it('fails instead of silently dropping child state if prompt renderer is unavailable',async()=>{
  vi.stubEnv('API_MODE','live');vi.stubEnv('OPENROUTER_API_KEY','router');vi.stubEnv('RANKER_URL','');
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  await expect(generateQuestion(columns[0] as Column,{q:[50,50,50,50,50,50]})).rejects.toThrow('MISSING_PROMPT_SERVICE');
  expect(fetch).not.toHaveBeenCalled();
 });
});
