export interface AiTaskContext { title: string; dueAt?: string | null; subject?: string | null; gradeContext?: string | null; notes?: string | null; }
export interface ChangeProposal { action: 'create_task' | 'update_task'; summary: string; payload: Record<string, string | null>; }

export function buildAiTaskPrompt(context: AiTaskContext) {
  return ['Help with this approved task context. Do not claim you changed anything.', `Task: ${context.title}`, context.dueAt ? `Due: ${context.dueAt}` : null, context.subject ? `Subject: ${context.subject}` : null, context.gradeContext ? `Grade context: ${context.gradeContext}` : null, context.notes ? `Notes: ${context.notes}` : null, 'Return concise suggestions and any proposed writes separately for review.'].filter(Boolean).join('\n');
}

export function canApplyProposal(proposal: ChangeProposal | null, confirmed: boolean) { return Boolean(proposal && confirmed); }
