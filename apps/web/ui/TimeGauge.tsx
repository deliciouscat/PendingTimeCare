'use client';
import {useEffect,useState} from 'react';

type Preparation={id:string;receivedAt:number;consultationAt:number;demo:boolean};
type Event={kind:string;scheduledAt:number;status:string};
const DAY=86400000;
const date=(time:number)=>new Date(time).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',month:'short',day:'numeric'});

export default function TimeGauge({preparation,events}:{preparation?:Preparation;events:Event[]}){
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(timer)},[preparation?.id]);
 const start=preparation?.receivedAt??now,end=preparation?.consultationAt??now;
 const duration=Math.max(1,end-start);
 const slots=events.filter(e=>e.status!=='cancelled').sort((a,b)=>a.scheduledAt-b.scheduledAt);
 let virtualNow=now;
 if(preparation?.demo){
  // Align the virtual days with the actual accelerated delivery slots.
  let columnIndex=0;
  const anchors=slots.map(e=>({real:e.scheduledAt,virtual:start+(e.kind==='column'?columnIndex++*2*DAY:Math.max(0,duration-DAY))}));
  if(anchors.length){
   anchors.push({real:anchors.at(-1)!.real+15000,virtual:end});
   virtualNow=start;
   for(let i=0;i<anchors.length-1;i++){
    const a=anchors[i],b=anchors[i+1];
    if(now>=b.real){virtualNow=b.virtual;continue}
    if(now>=a.real){const fraction=Math.min(1,(now-a.real)/Math.max(1,b.real-a.real));virtualNow=a.virtual+(b.virtual-a.virtual)*fraction}
    break;
   }
  }else virtualNow=start;
 }
 const elapsed=Math.max(0,Math.min(duration,virtualNow-start)),percent=preparation?elapsed/duration*100:0;
 const remaining=Math.max(0,Math.ceil((end-virtualNow)/DAY));
 return <div className="time-gauge">
  <div className="time-gauge-heading"><span>{preparation?.demo?'가상 시간선':'상담까지의 시간선'}</span><strong>{!preparation?'시작 전':percent>=100?'상담 시점':`상담까지 ${remaining}일`}</strong></div>
  <div className="time-gauge-track" role="progressbar" aria-label="상담 준비 시간선" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-valuetext={!preparation?'상담 준비 시작 전':`${preparation.demo?'가상 ':''}시간 ${Math.round(percent)}% 경과, 상담까지 ${remaining}일`}>
   <div className="time-gauge-fill" style={{width:`${percent}%`}}/>
   <span className="time-gauge-now" style={{left:`${percent}%`}}/>
  </div>
  <div className="time-gauge-labels"><span>준비 시작{preparation&&<small>{date(start)}</small>}</span><span className="time-gauge-current">{preparation?'현재':'대기 중'}{preparation&&<small>{date(start+elapsed)}</small>}</span><span>상담{preparation&&<small>{date(end)}</small>}</span></div>
  <p className="time-gauge-hint">{!preparation?'상담 준비를 시작하면 시간선이 표시됩니다.':preparation.demo?'단축 데모의 발송 일정에 맞춰 가상 시간이 흐릅니다. 실제 상담 날짜는 그대로입니다.':'준비 시작일부터 상담일까지의 경과 시간을 보여줍니다.'}</p>
 </div>;
}
