import type {Doc} from './_generated/dataModel';

/** Automatic validation is distinct from a recorded human review. */
export function questionAvailable(question:Doc<'questions'>|null,assessment:Doc<'assessments'>,columnId:string):question is Doc<'questions'>{
 if(!question||question.columnId!==columnId)return false;
 if(question.assessmentId){
  return question.assessmentId===assessment._id&&question.scheduleVersion===assessment.scheduleVersion&&['validated','reviewed'].includes(question.status);
 }
 return question.status==='reviewed';
}
