import { describe, expect, it } from 'vitest';
import { candidateWeightsAreComplete, extractCandidateWeights } from '../../lib/syllabus/weights';

describe('syllabus assessment weights', () => {
  it('extracts category weights and requires an exact 100% total for approval', () => {
    const weights = extractCandidateWeights('Quizzes - 20%\nExams: 50%\nFinal project 30%');
    expect(weights).toEqual([{ name: 'Quizzes', weightPercent: 20 }, { name: 'Exams', weightPercent: 50 }, { name: 'Final project', weightPercent: 30 }]);
    expect(candidateWeightsAreComplete(weights)).toBe(true);
  });
  it('keeps the syllabus state and next open assignment visible together on Subjects', async () => {
    const [source, taskQueue] = await import('node:fs/promises').then((fs) => Promise.all([fs.readFile('app/(app)/subjects/page.tsx', 'utf8'), fs.readFile('components/subjects/subject-task-queue.tsx', 'utf8')]));
    expect(source).toContain('Approved weights');
    expect(taskQueue).toContain('Next open assignment');
  });
});
