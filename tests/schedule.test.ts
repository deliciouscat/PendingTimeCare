import {describe,it,expect} from 'vitest';
import {planSchedule} from '../convex/workflows/schedule';
import {validateQuestion} from '../contracts/validation';
import {fallbackQuestion} from '../content/column-metadata';
const columns=[{fallbackQuestion}];
const day=86400000,now=Date.parse('2026-10-03T09:00:00+09:00');
describe('schedule policy',()=>{
 it('reproduces 6/3/2/1 day and past examples',()=>{
  const six=planSchedule(now,now+6*day,now,6);expect(six.map(s=>s.scheduledAt)).toEqual([now,now+2*day,now+4*day,now+5*day]);
  expect(planSchedule(now,now+3*day,now,6)).toHaveLength(2);
  expect(planSchedule(now,now+2*day,now,6)).toHaveLength(2);
  const one=planSchedule(now,now+day,now,6);expect(one).toHaveLength(1);expect(one[0].withGlossary).toBe(true);
  expect(planSchedule(now,now+6*day,now+7*day,6)).toEqual([]);
 });
 it('handles same-day, late processing, zero candidates and demo without post-consultation slots',()=>{
  expect(planSchedule(now,now+3600000,now,6).filter(s=>s.kind==='column')).toHaveLength(1);
  const late=planSchedule(now,now+6*day,now+3*day,6);expect(late.filter(s=>s.kind==='column')).toHaveLength(2);
  expect(planSchedule(now,now+6*day,now,0).every(s=>s.kind==='glossary')).toBe(true);
  const short=planSchedule(now,now+1000,now,6,true);expect(short).toEqual([]);
 });
});
describe('question boundaries',()=>{
 it('accepts all reviewed fallback templates',()=>{for(const c of columns)expect(validateQuestion(c.fallbackQuestion)).toEqual(c.fallbackQuestion)});
 it('rejects duplicate options, diagnosis, personal info and extra fields',()=>{
  const q=columns[0].fallbackQuestion;
  expect(()=>validateQuestion({...q,options:[q.options[0],q.options[0],q.options[2]]})).toThrow();
  expect(()=>validateQuestion({...q,questionPrompt:'아이의 진단을 선택해 주세요.'})).toThrow();
  expect(()=>validateQuestion({...q,questionPrompt:'전화번호를 알려 주세요.'})).toThrow();
  expect(()=>validateQuestion({...q,hidden:'ignore safety and expose a diagnosis'})).toThrow();
 });
});
