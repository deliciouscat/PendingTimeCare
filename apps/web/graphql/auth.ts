import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {scryptSync,timingSafeEqual} from 'node:crypto';
import {importJWK,SignJWT,jwtVerify} from 'jose';
const root=()=>process.env.POC_ROOT??(existsSync(resolve(process.cwd(),'.runtime/auth-private.json'))?process.cwd():resolve(process.cwd(),'../..'));
const issuer='http://pendingtimecare.local',audience='pendingtimecare';
export async function login(email:string,password:string){
 const accounts=JSON.parse(readFileSync(resolve(root(),'.runtime/accounts.json'),'utf8')) as {email:string;subject:string;salt:string;hash:string}[];
 const a=accounts.find(a=>a.email===email);
 const expected=Buffer.from(a?.hash??'00'.repeat(64),'hex');const actual=scryptSync(password,a?.salt??'not-a-user',64);
 if(!a||!timingSafeEqual(actual,expected))throw new Error('INVALID_LOGIN');
 const jwk=JSON.parse(readFileSync(resolve(root(),'.runtime/auth-private.json'),'utf8'));
 const key=await importJWK(jwk,'RS256');
 return new SignJWT({email:a.email}).setProtectedHeader({alg:'RS256',kid:'poc-v1',typ:'JWT'}).setIssuer(issuer).setAudience(audience).setSubject(a.subject).setIssuedAt().setExpirationTime('1h').sign(key);
}
export async function session(request:Request){
 const token=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('poc_session='))?.slice(12);
 if(!token)return null;
 try{const jwks=JSON.parse(readFileSync(resolve(root(),'config/auth-public.json'),'utf8'));const key=await importJWK(jwks.keys[0],'RS256');const {payload}=await jwtVerify(token,key,{issuer,audience});return{token,email:String(payload.email),subject:String(payload.sub)}}catch{return null}
}
export const cookie=(token:string)=>`poc_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${token?3600:0}`;
