/** One command bootstrap. .env is read before any provider, Python or web starts. */
import {spawn,spawnSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
const root=resolve(import.meta.dirname,'..');process.chdir(root);process.env.POC_ROOT=root;
const children=[];
let ignoreBefore;
function restoreIgnore(){if(ignoreBefore===undefined||ignoreBefore===null||!existsSync('.gitignore'))return;const now=readFileSync('.gitignore','utf8');if(now===ignoreBefore+'\n.env.local\n')writeFileSync('.gitignore',ignoreBefore)}
function run(command,args,options={}){return new Promise((resolve,reject)=>{const p=spawn(command,args,{cwd:root,stdio:'inherit',env:process.env,...options});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(new Error(`${command} failed (${code})`)))})}
function start(command,args,onOutput){const p=spawn(command,args,{cwd:root,stdio:onOutput?['inherit','pipe','pipe']:'inherit',env:process.env,detached:process.platform!=='win32'});if(onOutput){for(const [stream,target] of [[p.stdout,process.stdout],[p.stderr,process.stderr]])stream.on('data',chunk=>{target.write(chunk);onOutput(chunk.toString())})}children.push(p);p.on('error',e=>{console.error(e.message);shutdown(1)});p.on('exit',code=>{if(!stopping){console.error(`${command} stopped (${code})`);shutdown(code||1)}});return p}
let stopping=false;
function shutdown(code=0){if(stopping)return;stopping=true;restoreIgnore();for(const p of children){try{if(process.platform==='win32')p.kill('SIGTERM');else process.kill(-p.pid,'SIGTERM')}catch{}}setTimeout(()=>process.exit(code),1500)}
process.on('SIGINT',()=>shutdown());process.on('SIGTERM',()=>shutdown());
async function wait(url,timeout=90000){const deadline=Date.now()+timeout;while(Date.now()<deadline){try{const response=await fetch(url);if(response.ok)return}catch{}await new Promise(r=>setTimeout(r,500))}throw new Error(`Timed out: ${url}`)}
try{
 if(!existsSync('node_modules/.bin/tsx'))await run('npm',['ci']);
 // Preserve original .gitignore; local generated files and secrets are excluded per checkout.
 const top=spawnSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'});
 if(top.status===0&&resolve(top.stdout.trim())===root){
  const out=spawnSync('git',['rev-parse','--git-path','info/exclude'],{encoding:'utf8'});const path=out.stdout.trim();
  const prior=existsSync(path)?readFileSync(path,'utf8'):'';
  const patterns=['.env','.env.*','!.env.example','.runtime/','.convex/','config/auth-public.json','node_modules/','.venv/','.next/','__pycache__/','.pytest_cache/','*.pyc','*.tsbuildinfo','test-results/','playwright-report/'];
  const missing=patterns.filter(p=>!prior.split('\n').includes(p));
  if(missing.length)writeFileSync(path,prior+'\n'+missing.join('\n')+'\n');
 }
 const {config,parse}=await import('dotenv');config({path:'.env',quiet:true});
 process.env.CONVEX_AGENT_MODE='anonymous';delete process.env.CONVEX_DEPLOY_KEY;
 if(existsSync('.env.local')){const chosen=parse(readFileSync('.env.local')).CONVEX_DEPLOYMENT;if(chosen&&!chosen.startsWith('anonymous:')&&!chosen.startsWith('local:'))throw new Error('A cloud Convex deployment is configured. Use a separate local checkout for this demo.')}
 try{if((await fetch('http://127.0.0.1:3210/version',{signal:AbortSignal.timeout(1000)})).ok)throw new Error('LOCAL_BACKEND_ALREADY_RUNNING')}catch(e){if(e.message==='LOCAL_BACKEND_ALREADY_RUNNING')throw e}
 await run('uv',['sync','--frozen']);await run('npx',['tsx','scripts/prepare-auth.ts']);
 const rankerPort=process.env.RANKER_PORT??'8000';const webPort=process.env.WEB_PORT??'3000';
 if(!existsSync('.runtime/ranker-token.txt'))writeFileSync('.runtime/ranker-token.txt',randomBytes(32).toString('hex'),{mode:0o600});
 process.env.RANKER_TOKEN=readFileSync('.runtime/ranker-token.txt','utf8');
 ignoreBefore=existsSync('.gitignore')?readFileSync('.gitignore','utf8'):null;
 // Bootstrap only a local dev deployment; no login or cloud deployment is created.
 let convexOutput='';let functionsReady=false;
 start('npx',['convex','dev','--typecheck','disable','--tail-logs','disable'],chunk=>{convexOutput=(convexOutput+chunk).slice(-10000);functionsReady=convexOutput.includes('Convex functions ready!')});
 await wait('http://127.0.0.1:3210/version');
 const convexDeadline=Date.now()+120000;
 while(!functionsReady||!existsSync('.env.local')){if(Date.now()>convexDeadline)throw new Error('Timed out waiting for local Convex configuration and function deployment');await new Promise(r=>setTimeout(r,500))}
 restoreIgnore();
 const deployment=parse(readFileSync('.env.local'));
 if(!deployment.CONVEX_DEPLOYMENT?.startsWith('anonymous:')&&!deployment.CONVEX_DEPLOYMENT?.startsWith('local:'))throw new Error('Turnkey demo requires a local Convex deployment; see IMPLEMENTATION.md.');
 process.env.CONVEX_URL=deployment.NEXT_PUBLIC_CONVEX_URL;
 process.env.NEXT_PUBLIC_CONVEX_URL=process.env.CONVEX_URL;
 const env={RANKER_URL:`http://127.0.0.1:${rankerPort}`,RANKER_TOKEN:process.env.RANKER_TOKEN,DEMO_ENABLED:'true',API_MODE:process.env.API_MODE??'auto',...Object.fromEntries(['OPENROUTER_API_KEY','JEV_MODEL','RERANK_MODEL','QUESTION_MODEL'].map(k=>[k,process.env[k]??'']))};
 writeFileSync('.runtime/convex.env',Object.entries(env).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n'),{mode:0o600});
 await run('npx',['convex','env','set','--from-file','.runtime/convex.env','--force']);
 // Prepare features and question drafts only inside Convex internal actions.
 await run('npx',['tsx','scripts/prepare-content.ts']);
 const artifact=readFileSync('.runtime/artifact-path.txt','utf8');
 if(!existsSync(`${artifact}/model.ubj`)||!existsSync(`${artifact}/manifest.json`))await run('uv',['run','python','-m','training.lambdamart.pipeline','--output',artifact,'--columns','.runtime/prepared-columns.json']);
 process.env.RANKER_ARTIFACT=resolve(root,artifact);
 start('uv',['run','uvicorn','services.ranker.api.main:app','--host','127.0.0.1','--port',rankerPort]);await wait(`http://127.0.0.1:${rankerPort}/health`);
 restoreIgnore();
 start('npx',['next','dev','apps/web','-p',webPort,'-H','127.0.0.1']);await wait(`http://localhost:${webPort}`);
 const credentials=JSON.parse(readFileSync('.runtime/demo-login.json','utf8'));
 console.log(`\nReady: http://localhost:${webPort}\nLocal demo login: ${credentials.email}\nLocal demo password: ${credentials.password}\nCtrl+C stops all components.\n`);
}catch(e){console.error(`Startup failed: ${e.message}`);shutdown(1)}
