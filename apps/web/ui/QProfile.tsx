import config from '../../../config/poc.json';

const labels:Record<string,string>={
 attention_problems_t:'주의집중 문제',
 total_problems_t:'총 문제행동',
 internalizing_t:'내재화',
 depressed_anxious_t:'우울/불안',
 social_immaturity_t:'사회적 미성숙',
 withdrawn_t:'위축',
};

export default function QProfile({q}:{q:(number|null)[]}){
 return <section className="q-profile" aria-labelledby="q-profile-title">
  <h3 id="q-profile-title">보고서 척도 · q</h3>
  <p className="q-description">q는 아래 순서로 저장되는 여섯 척도의 T점수입니다. null은 결측값입니다.</p>
  <div className="q-rows">
   {config.qFeatureOrder.map((id,index)=>{
    const value=q[index]??null,label=labels[id]??id;
    const kind=config.qScales.find(scale=>scale.id===id)?.kind;
    return <div className="q-row" key={id}>
     <div className="q-row-heading"><div className="q-label"><code>q[{index}]</code><span>{label}</span><small>{kind==='composite'?'종합척도':'개별척도'}</small></div><strong>{value===null?'결측':`${value} T`}</strong></div>
     {value===null?<div className="q-track q-missing" aria-label={`${label}: 결측 (null)`}><span>null · 값 없음</span></div>:<div className="q-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-valuetext={`${value} T점수`}><div className="q-fill" style={{width:`${value}%`}}/></div>}
    </div>;
   })}
  </div>
  <div className="q-axis" aria-hidden="true"><span>0</span><span>50</span><span>100</span></div>
  <p className="q-caption">막대 표시 범위: 0–100 · 확률이나 임상 판정이 아닙니다.</p>
 </section>;
}
