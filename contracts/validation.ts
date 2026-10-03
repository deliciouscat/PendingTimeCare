import questionSchema from './question.schema.json';
import { z } from 'zod';
export const qSchema=z.array(z.number().min(0).max(100).nullable()).length(6);
export const assessmentSchema=z.object({q:qSchema,receivedAt:z.number().finite(),consultationAt:z.number().finite(),timezone:z.literal('Asia/Seoul'),featureSchemaVersion:z.literal('v1'),demo:z.boolean().default(false)}).strict().refine(x=>x.consultationAt>x.receivedAt,'INVALID_DATES');
export type AssessmentInput=z.infer<typeof assessmentSchema>;
export type Question={questionPrompt:string;options:{id:string;text:string}[];freeTextHint:string};
const p=questionSchema.properties;
const questionValidator=z.object({questionPrompt:z.string().min(p.questionPrompt.minLength).max(p.questionPrompt.maxLength),freeTextHint:z.string().max(p.freeTextHint.maxLength),options:z.array(z.object({id:z.string().min(p.options.items.properties.id.minLength).max(p.options.items.properties.id.maxLength),text:z.string().min(p.options.items.properties.text.minLength).max(p.options.items.properties.text.maxLength)}).strict()).length(p.options.minItems)}).strict();
const forbidden=/진단|처방|위험도|의심|심각|위험|의학|약물|연락처|전화번호|주민등록|주소를|퀴즈|정답|diagnos|prescri|phone\s*number|e-?mail|suicid|risk\s*level/i;
export function validateQuestion(value:unknown):Question {
 if(!questionValidator.safeParse(value).success) throw new Error('INVALID_QUESTION_SCHEMA');
 const q=value as Question;
 if(new Set(q.options.map(o=>o.id)).size!==3 || new Set(q.options.map(o=>o.text.trim())).size!==3 || forbidden.test([q.questionPrompt,q.freeTextHint,...q.options.map(o=>o.text)].join(' '))) throw new Error('UNSAFE_QUESTION');
 return q;
}
export function publicError(code:string):never{throw new Error(code)}
