import { describe, expect, it } from 'vitest';
import { buildAiTaskPrompt, canApplyProposal } from '../../lib/ai/proposals';
import { buildAssignmentStarterPrompt } from '../../components/ai/assignment-prompt';

describe('AI proposal safety', () => {
  it('creates a minimal, copyable prompt from approved context', () => {
    expect(buildAiTaskPrompt({ title: 'Problem set', subject: 'Quant 121' })).toContain('Task: Problem set\nSubject: Quant 121');
  });
  it('requires a review confirmation before a proposed write can apply', () => {
    const proposal = { action: 'create_task' as const, summary: 'Create a task', payload: {} };
    expect(canApplyProposal(proposal, false)).toBe(false);
    expect(canApplyProposal(proposal, true)).toBe(true);
  });
  it('keeps the copyable assignment start local and free of encrypted-vault data', () => {
    const prompt = buildAssignmentStarterPrompt({ id: 'task-1', title: 'Lab report', kind: 'school', dueAt: null, priority: 'normal', termId: null, subjectId: null, projectId: null, weightPercent: null, description: '', links: [], effortMinutes: null, completedAt: null, updatedAt: '2026-07-19T00:00:00.000Z', source: 'canvas', sourceId: 'canvas-1' }, 'BIO 101', ['Labs']);
    expect(prompt).toContain('without writing it for me');
    expect(prompt).toContain('Assessment context: Labs');
    expect(prompt).not.toMatch(/vault|ciphertext|secret|api[_ -]?key/i);
  });
});
