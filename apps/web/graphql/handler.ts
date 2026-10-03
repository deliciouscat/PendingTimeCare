import {graphql,buildSchema} from 'graphql';
import {ConvexHttpClient} from 'convex/browser';
import {api} from '../../../convex/_generated/api';
import {login,session,cookie} from './auth';
import reports from '../../../fixtures/synthetic/reports.json';
const schema=buildSchema(`
 type User {email:String!}
 type Sample {id:String!,familyId:String!,name:String!,q:[Float]!,featureSchemaVersion:String!,observationTopics:[String!]!,consultationNote:String!,provenance:String!}
 type PreparationProgress {catalog:String!,ranking:String!,questions:String!,linking:String!,scheduling:String!,selectedColumnCount:Int!,questionTotal:Int!,questionCompleted:Int!,questionFailed:Int!}
 type Assessment {id:ID!,status:String!,consultationAt:Float!,receivedAt:Float!,demo:Boolean!,fallbackReason:String,progress:PreparationProgress}
 type TimelineItem {id:ID!,kind:String!,title:String!,scheduledAt:Float!,status:String!,withGlossary:Boolean!,answered:Boolean!,skipped:Boolean!}
 type Option {id:String!,text:String!}
 type Question {id:ID!,version:String!,questionPrompt:String!,options:[Option!]!,freeTextHint:String!}
 type SavedResponse {optionId:String,freeText:String!,skipped:Boolean!}
 type Glossary {title:String!,body:String!}
 type CareItem {id:ID!,assessmentId:ID!,title:String!,body:String!,question:Question,glossary:Glossary,response:SavedResponse,reviewScope:String!}
 type Created {id:ID!,status:String!}
 type Saved {id:ID!,saved:Boolean!}
 input AssessmentInput {q:[Float]!,receivedAt:Float!,consultationAt:Float!,timezone:String!,featureSchemaVersion:String!,demo:Boolean!}
 type Query {me:User,samples:[Sample!]!,assessments:[Assessment!]!,assessment(id:ID!):Assessment!,careTimeline(assessmentId:ID!):[TimelineItem!]!,careItem(id:ID!):CareItem!}
 type Mutation {login(email:String!,password:String!):User!,logout:Boolean!,createAssessment(input:AssessmentInput!,idempotencyKey:String!):Created!,submitResponse(messageId:ID!,questionId:ID!,optionId:String!,freeText:String):Saved!,skipQuestion(messageId:ID!,questionId:ID!):Saved!}
`);
export async function handle(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({errors:[{message:'FORBIDDEN'}]},{status:403});
 if(!request.headers.get('content-type')?.includes('application/json'))return Response.json({errors:[{message:'INVALID_INPUT'}]},{status:415});
 const text=await request.text();if(text.length>64000)return Response.json({errors:[{message:'INVALID_INPUT'}]},{status:413});
 let body:any;try{body=JSON.parse(text)}catch{return Response.json({errors:[{message:'INVALID_INPUT'}]},{status:400})}
 if(typeof body.query!=='string'||body.query.length>12000)return Response.json({errors:[{message:'INVALID_INPUT'}]},{status:400});
 const user=await session(request);let setCookie:string|undefined;
 const client=new ConvexHttpClient(process.env.CONVEX_URL??process.env.NEXT_PUBLIC_CONVEX_URL??'http://127.0.0.1:3210');if(user)client.setAuth(user.token);
 const requireUser=()=>{if(!user)throw new Error('FORBIDDEN')};
 const root={
  me:()=>user?{email:user.email}:null,
  login:async({email,password}:any)=>{if(typeof password!=='string'||password.length>128||email.length>128)throw new Error('INVALID_LOGIN');const token=await login(email,password);setCookie=cookie(token);return{email}},
  logout:()=>{setCookie=cookie('');return true},
  samples:()=>{requireUser();return reports},
  assessments:()=>{requireUser();return client.query(api.assessments.list,{})},
  assessment:({id}:any)=>{requireUser();return client.query(api.assessments.get,{id})},
  careTimeline:({assessmentId}:any)=>{requireUser();return client.query(api.care.timeline,{assessmentId})},
  careItem:({id}:any)=>{requireUser();return client.query(api.care.item,{id})},
  createAssessment:({input,idempotencyKey}:any)=>{requireUser();return client.mutation(api.assessments.create,{input,idempotencyKey})},
  submitResponse:({messageId,questionId,optionId,freeText}:any)=>{requireUser();return client.mutation(api.care.respond,{messageId,questionId,optionId,...(freeText?{freeText}:{}),skipped:false})},
  skipQuestion:({messageId,questionId}:any)=>{requireUser();return client.mutation(api.care.respond,{messageId,questionId,skipped:true})}
 };
 const result=await graphql({schema,source:body.query,rootValue:root,variableValues:body.variables,operationName:body.operationName});
 const known=['FORBIDDEN','INVALID_INPUT','INVALID_LOGIN','IDEMPOTENCY_CONFLICT','NOT_AVAILABLE'];
 const response={...result,...(result.errors?{errors:result.errors.map(e=>({message:known.find(c=>e.message.includes(c))??'TEMPORARY_UNAVAILABLE'}))}:{})};
 return Response.json(response,{headers:{...(setCookie?{'Set-Cookie':setCookie}:{}),'Cache-Control':'no-store'}});
}
