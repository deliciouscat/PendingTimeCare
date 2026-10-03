import {defineSchema,defineTable} from 'convex/server';
import {v} from 'convex/values';
const q=v.array(v.union(v.number(),v.null()));
export default defineSchema({
 preparations:defineTable({key:v.string(),data:v.any()}).index('by_key',['key']),
 columns:defineTable({columnId:v.string(),version:v.string(),title:v.string(),body:v.string(),rerankText:v.optional(v.string()),sourceFile:v.optional(v.string()),topic:v.string(),status:v.string(),review:v.any(),n:v.array(v.number()),m:v.array(v.number()),featureVersion:v.string(),events:v.array(v.any()),questionDraftVersion:v.optional(v.string())}).index('by_column',['columnId']),
 questions:defineTable({columnId:v.string(),version:v.string(),question:v.any(),status:v.string(),model:v.string(),promptVersion:v.string(),review:v.optional(v.any()),event:v.optional(v.any())}).index('by_column',['columnId']),
 assessments:defineTable({guardianId:v.string(),q,receivedAt:v.number(),consultationAt:v.number(),timezone:v.string(),featureSchemaVersion:v.string(),demo:v.boolean(),status:v.string(),scheduleVersion:v.number(),requestKey:v.string(),inputHash:v.string(),fallbackReason:v.optional(v.string())}).index('by_request',['guardianId','requestKey']).index('by_guardian',['guardianId']),
 recommendations:defineTable({assessmentId:v.id('assessments'),columnId:v.string(),rank:v.number(),score:v.number(),modelVersion:v.string(),algorithmVersion:v.string()}).index('by_assessment',['assessmentId']),
 scheduledMessages:defineTable({assessmentId:v.id('assessments'),scheduleVersion:v.number(),kind:v.string(),slotIndex:v.number(),scheduledAt:v.number(),status:v.string(),attemptCount:v.number(),columnId:v.optional(v.string()),questionId:v.optional(v.id('questions')),withGlossary:v.boolean(),claimToken:v.optional(v.string()),leaseUntil:v.optional(v.number()),sentAt:v.optional(v.number()),errorCode:v.optional(v.string())}).index('by_assessment',['assessmentId']).index('by_status',['status']),
 responses:defineTable({guardianId:v.string(),assessmentId:v.id('assessments'),messageId:v.id('scheduledMessages'),questionId:v.id('questions'),optionId:v.optional(v.string()),freeText:v.optional(v.string()),skipped:v.boolean(),submittedAt:v.number()}).index('by_message',['messageId'])
});
