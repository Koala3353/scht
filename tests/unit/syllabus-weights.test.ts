import { describe, expect, it } from 'vitest';
import { candidateWeightsAreComplete, extractCandidateWeights } from '../../lib/syllabus/weights';

describe('syllabus assessment weights', () => {
  it('extracts category weights and requires an exact 100% total for approval', () => {
    const weights = extractCandidateWeights('Quizzes - 20%\nExams: 50%\nFinal project 30%');
    expect(weights).toEqual([{ name: 'Quizzes', weightPercent: 20 }, { name: 'Exams', weightPercent: 50 }, { name: 'Final project', weightPercent: 30 }]);
    expect(candidateWeightsAreComplete(weights)).toBe(true);
  });
});
