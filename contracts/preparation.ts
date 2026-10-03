export type StepState='idle'|'loading'|'done'|'fallback'|'failed';
export type PreparationStep='catalog'|'ranking'|'questions'|'linking'|'scheduling';
export type PreparationProgress=Record<PreparationStep,StepState>&{
 selectedColumnCount:number;
 questionTotal:number;
 questionCompleted:number;
 questionFailed:number;
};
export function initialProgress():PreparationProgress{
 return {catalog:'loading',ranking:'idle',questions:'idle',linking:'idle',scheduling:'idle',selectedColumnCount:0,questionTotal:0,questionCompleted:0,questionFailed:0};
}
