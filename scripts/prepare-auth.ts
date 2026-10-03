import {generateKeyPair,exportJWK} from 'jose';
import {scryptSync,randomBytes,createPublicKey} from 'node:crypto';
import {existsSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {config} from 'dotenv';
config({path:'.env',quiet:true});mkdirSync('.runtime',{recursive:true});
if(!existsSync('.runtime/auth-private.json')){
 const {privateKey,publicKey}=await generateKeyPair('RS256',{extractable:true});
 writeFileSync('.runtime/auth-private.json',JSON.stringify({...await exportJWK(privateKey),kid:'poc-v1',alg:'RS256'}),{mode:0o600});
 writeFileSync('config/auth-public.json',JSON.stringify({keys:[{...await exportJWK(publicKey),kid:'poc-v1',alg:'RS256',use:'sig'}]},null,2)+'\n');
}
const privateJwk=JSON.parse(readFileSync('.runtime/auth-private.json','utf8'));
const publicJwk=createPublicKey({key:privateJwk,format:'jwk'}).export({format:'jwk'});
writeFileSync('config/auth-public.json',JSON.stringify({keys:[{...publicJwk,kid:'poc-v1',alg:'RS256',use:'sig'}]},null,2)+'\n');
const oldLogin=existsSync('.runtime/demo-login.json')?JSON.parse(readFileSync('.runtime/demo-login.json','utf8')):null;
if(!existsSync('.runtime/accounts.json')||(process.env.DEMO_PASSWORD&&process.env.DEMO_PASSWORD!==oldLogin?.password)){
 const password=process.env.DEMO_PASSWORD||randomBytes(12).toString('base64url');
 const accounts=['guardian1@example.test','guardian2@example.test'].map((email,i)=>{const salt=randomBytes(16).toString('hex');return{email,subject:`guardian-${i+1}`,salt,hash:scryptSync(password,salt,64).toString('hex')}});
 writeFileSync('.runtime/accounts.json',JSON.stringify(accounts),{mode:0o600});
 writeFileSync('.runtime/demo-login.json',JSON.stringify({email:accounts[0].email,password}),{mode:0o600});
}
