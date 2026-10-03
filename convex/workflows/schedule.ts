const DAY=86400000,OFFSET=9*3600000;
const day=(ts:number)=>Math.floor((ts+OFFSET)/DAY);
export type Slot={kind:'column'|'glossary';scheduledAt:number;withGlossary:boolean};
export function planSchedule(receivedAt:number,consultationAt:number,now:number,available:number,demo=false):Slot[]{
 if(![receivedAt,consultationAt,now].every(Number.isFinite)||consultationAt<=receivedAt)throw new Error('INVALID_DATES');
 if(consultationAt<=now)return[];
 const d=day(consultationAt)-day(receivedAt);const k=Math.min(available,Math.max(1,Math.floor(d/2)));
 if(demo){const result:Slot[]=Array.from({length:k},(_,i)=>({kind:'column',scheduledAt:now+2000+i*15000,withGlossary:false}));const g=now+2000+k*15000;if(g<consultationAt)result.push({kind:'glossary',scheduledAt:g,withGlossary:true});return result.filter(s=>s.scheduledAt<consultationAt)}
 const slots:Slot[]=[];const used=new Set<number>();
 for(let i=0;i<k;i++){
  const target=receivedAt+i*2*DAY;const at=Math.max(now,target);
  if(at>=consultationAt||used.has(day(at)))continue;
  used.add(day(at));slots.push({kind:'column',scheduledAt:at,withGlossary:false});
 }
 const glossaryAt=(day(consultationAt)-1)*DAY-OFFSET+9*3600000;
 if(glossaryAt>=receivedAt&&glossaryAt>=now&&glossaryAt<consultationAt){
  const same=slots.find(s=>day(s.scheduledAt)===day(glossaryAt));
  if(same)same.withGlossary=true;else slots.push({kind:'glossary',scheduledAt:glossaryAt,withGlossary:true});
 }
 return slots.sort((a,b)=>a.scheduledAt-b.scheduledAt);
}
