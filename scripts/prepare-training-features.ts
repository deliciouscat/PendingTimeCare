/** Columns and synthetic consultation notes share the same document featurizer. */
import {config as dotenv} from 'dotenv';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {loadColumns} from '../content/load-columns';
import {documentFeatures,FEATURE_PROMPT_VERSION,JEV_DEFAULT_MODEL,rerankModel,JEV_ENDPOINT,RERANK_ENDPOINT} from '../convex/adapters/providers';
import config from '../config/poc.json';
import references from '../content/references.json';

dotenv({path:'.env',quiet:true});
const args=process.argv.slice(2);
function option(name:string){const i=args.indexOf(name);return i<0?undefined:args[i+1]}
const mode=option('--mode')??process.env.API_MODE??'auto';
if(!['auto','mock','live'].includes(mode))throw new Error('INVALID_API_MODE');
process.env.API_MODE=mode;
const sourceMode=mode!=='mock'&&Boolean(process.env.OPENROUTER_API_KEY)?'live':'mock';
if(mode==='live'&&sourceMode!=='live')throw new Error('MISSING_PROVIDER_KEY');
const cacheDir=resolve('.runtime/training-feature-cache');await mkdir(cacheDir,{recursive:true});
const columnPath=option('--columns');
const columns=columnPath?JSON.parse(await readFile(columnPath,'utf8')):await loadColumns();
const reports=JSON.parse(await readFile('fixtures/synthetic/reports.json','utf8'));
// Mock-only lexical stand-ins. They do not read observationTopics or relevance labels.
const typeTexts=['주의 집중 산만 숙제 활동','학습 배우는 속도 작은 단계 안내 이해','정서 감정 위축 신체 불안','우울 불안 걱정 긴장 낯선 상황','사회 미성숙 친구 또래 관계','위축 혼자 쉬는 소극적 태도'];
function tokens(text:string){const words=text.toLowerCase().match(/[가-힣a-z0-9]+/g)??[];return new Set(words.flatMap(w=>[w,...Array.from({length:Math.max(0,w.length-1)},(_,i)=>w.slice(i,i+2))]))}
function overlap(a:Set<string>,b:Set<string>){const shared=[...a].filter(t=>b.has(t)).length;return shared/Math.sqrt(Math.max(1,a.size*b.size))}
function mockFeatures(text:string){const t=tokens(text);return{n:references.map(r=>overlap(t,tokens(r.body))),m:typeTexts.map(d=>overlap(t,tokens(d)))}}
async function featurize(id:string,text:string){
 if(typeof text!=='string'||!text.trim())throw new Error('EMPTY_DOCUMENT');
 const contentHash=createHash('sha256').update(text).digest('hex');
 const identity={contentHash,featureSchemaVersion:config.featureSchemaVersion,referenceIds:config.referenceIds,referenceSetVersion:config.referenceSetVersion,taxonomyVersion:config.taxonomyVersion,consultationTypes:config.consultationTypes,references,sourceMode,featurePromptVersion:FEATURE_PROMPT_VERSION,jevEndpoint:JEV_ENDPOINT,rerankEndpoint:RERANK_ENDPOINT,models:[process.env.JEV_MODEL||JEV_DEFAULT_MODEL,rerankModel()]};
 const cacheKey=createHash('sha256').update(JSON.stringify(identity)).digest('hex');const file=resolve(cacheDir,`${cacheKey}.json`);
 let f;
 try{f=JSON.parse(await readFile(file,'utf8'));if(f.cacheKey!==cacheKey||f.n.length!==config.referenceIds.length||f.m.length!==config.consultationTypes.length)throw new Error('INVALID_CACHE');f.events=f.events.map((e:any)=>({...e,cacheHit:true}))}
 catch(e:any){if(e.code!=='ENOENT')throw e;f={...await documentFeatures({body:text,mockFeatures:mockFeatures(text)}),cacheKey,contentHash};await writeFile(file,JSON.stringify(f),{mode:0o600})}
 console.error(`[training features] ${id}: ${sourceMode}${f.events.every((e:any)=>e.cacheHit)?' (cached)':''}`);
 return{...f,sourceMode,featurePromptVersion:FEATURE_PROMPT_VERSION};
}
const prepared=[];
for(const column of columns){const f=await featurize(column.id,column.rerankText??column.body);prepared.push({...column,...f,mockFeatures:{n:f.n,m:f.m}})}
const notes=[];
for(const report of reports){const f=await featurize(report.id,report.consultationNote);notes.push({reportId:report.id,familyId:report.familyId,...f})}
process.stdout.write(JSON.stringify({columns:prepared,consultationFeatures:notes,featureSchemaVersion:config.featureSchemaVersion,referenceSetVersion:config.referenceSetVersion,taxonomyVersion:config.taxonomyVersion,sourceMode}));
