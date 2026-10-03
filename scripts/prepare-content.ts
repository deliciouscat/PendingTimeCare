import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import config from '../config/poc.json';
// The CLI uses the local admin credential; provider calls happen inside internal action.
const result=spawnSync('npx',['convex','run','workflows/prepare:run','{}'],{encoding:'utf8'});
if(result.status!==0){console.error(result.stderr);throw new Error('CONTENT_PREPARATION_FAILED')}
const prepared=JSON.parse(result.stdout);
for(const c of prepared)console.log(`[${c.id}] ${c.events.map((e:any)=>`${e.provider}:${e.mode}${e.cacheHit?'(cached)':''}`).join(', ')} / 질문:${c.draft?.event.mode??'fallback'}`);
writeFileSync('.runtime/prepared-columns.json',JSON.stringify(prepared),{mode:0o600});
const key=createHash('sha256').update(JSON.stringify({config,trainingPipelineVersion:'consultation-features-v2',columns:prepared.map((c:any)=>({id:c.id,body:c.body,rerankText:c.rerankText,n:c.n,m:c.m,sourceMode:c.sourceMode,featureCacheKey:c.cacheKey,providers:c.events.map((e:any)=>({provider:e.provider,model:e.model,mode:e.mode}))}))})).digest('hex').slice(0,12);
writeFileSync('.runtime/artifact-path.txt',`artifacts/poc-${key}`);
