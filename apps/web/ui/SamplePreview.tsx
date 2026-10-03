'use client';
import {useEffect,useRef,useState} from 'react';
import QProfile from './QProfile';

type Sample={id:string;name:string;q:(number|null)[]}&Record<string,unknown>;
function JsonCode({value}:{value:Sample}){
 const source=JSON.stringify(value,null,2);
 const pieces=[];let cursor=0;
 const tokens=/"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
 for(const match of source.matchAll(tokens)){
  const index=match.index!;pieces.push(source.slice(cursor,index));
  const token=match[0];const type=token.startsWith('"')?(source.slice(index+token.length).trimStart().startsWith(':')?'key':'string'):token==='null'?'null':token==='true'||token==='false'?'boolean':'number';
  pieces.push(<span key={index} className={`json-${type}`}>{token}</span>);cursor=index+token.length;
 }
 pieces.push(source.slice(cursor));
 return <pre className="sample-json" tabIndex={0} aria-label="선택된 합성 사례 JSON"><code>{pieces}</code></pre>;
}

export default function SamplePreview({sample}:{sample?:Sample}){
 const [open,setOpen]=useState(false);const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  if(!open||!dialog.current)return;
  const node=dialog.current,previous=document.body.style.overflow;
  node.showModal();document.body.style.overflow='hidden';
  return()=>{node.close();document.body.style.overflow=previous};
 },[open]);
 return <>
  <button className="sample-preview-button" type="button" disabled={!sample} onClick={()=>setOpen(true)}>
   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h6"/></svg>
   선택한 합성 사례 보기
  </button>
  <dialog ref={dialog} className="sample-dialog" aria-labelledby="sample-dialog-title" onClose={()=>setOpen(false)} onClick={event=>{if(event.target===event.currentTarget)dialog.current?.close()}}>
   <div className="sample-dialog-content">
    <div className="sample-dialog-header"><div><p className="eyebrow">합성 데이터 · 척도 보기</p><h2 id="sample-dialog-title">{sample?.name??'합성 사례'}</h2></div><button type="button" className="quiet" autoFocus onClick={()=>dialog.current?.close()}>닫기</button></div>
    {sample&&<><QProfile q={sample.q}/><details className="sample-source"><summary>원본 JSON 보기</summary><JsonCode value={sample}/></details></>}
   </div>
  </dialog>
 </>;
}
