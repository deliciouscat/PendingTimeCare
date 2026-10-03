import type {QueryCtx,MutationCtx} from './_generated/server';
import type {Id} from './_generated/dataModel';
export async function guardian(ctx:QueryCtx|MutationCtx){const user=await ctx.auth.getUserIdentity();if(!user?.subject)throw new Error('FORBIDDEN');return user.subject;}
export async function own(ctx:QueryCtx|MutationCtx,id:Id<'assessments'>){const user=await guardian(ctx);const assessment=await ctx.db.get(id);if(!assessment||assessment.guardianId!==user)throw new Error('FORBIDDEN');return assessment;}
