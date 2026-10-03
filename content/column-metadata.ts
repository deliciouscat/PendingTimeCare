// Demo-only column feature fixtures and fallback questions; article text lives in Markdown.
export const columnMetadata:Record<string,{topic:string;topics:string[];n:number[];m:number[]}>= {
 '1':{topic:'peers',topics:['attention','peers'],n:[.8,.25,.8],m:[.8,.1,.25,.2,.8,.25]},
 '2':{topic:'worry',topics:['learning','worry'],n:[.7,.9,.35],m:[.3,.8,.9,.85,.3,.3]},
 '3':{topic:'emotions',topics:['emotions','withdrawal'],n:[.3,.85,.7],m:[.2,.2,.8,.7,.65,.8]},
};
export const fallbackQuestion={
 questionPrompt:'칼럼을 읽으며 떠오른 최근 아이와의 생활 장면은 어떤 모습이었나요?',
 options:[{id:'option-1',text:'함께 편안하게 보낸 장면'},{id:'option-2',text:'서로 마음을 이해하기 어려웠던 장면'},{id:'option-3',text:'아직 떠오르는 장면이 없어요'}],
 freeTextHint:'상담에서 함께 이야기하고 싶은 생활 장면을 적어 주세요. (선택)',
};
