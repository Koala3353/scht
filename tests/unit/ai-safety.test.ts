import { describe, expect, it } from 'vitest';
import { buildAiTaskPrompt, canApplyProposal } from '../../lib/ai/proposals';

describe('AI proposal safety', () => {
  it('creates a minimal, copyable prompt from approved context', () => {
    expect(buildAiTaskPrompt({ title: 'Problem set', subject: 'Quant 121' })).toContain('Task: Problem set\nSubject: Quant 121');
  });
  it('requires a review confirmation before a proposed write can apply', () => {
    const proposal = { action: 'create_task' as const, summary: 'Create a task', payload: {} };
    expect(canApplyProposal(proposal, false)).toBe(false);
    expect(canApplyProposal(proposal, true)).toBe(true);
  });
});
