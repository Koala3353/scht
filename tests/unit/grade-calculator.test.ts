import { describe, expect, it } from 'vitest';
import { calculateGrade, validateGradeWeights } from '../../lib/grades/calculator';

describe('grade calculation', () => {
  const categories = [{ id: 'quiz', name: 'Quizzes', weightPercent: 40 }, { id: 'exam', name: 'Exams', weightPercent: 60 }];
  it('calculates earned and projected standing from approved category weights', () => {
    expect(calculateGrade(categories, [{ categoryId: 'quiz', score: 32, possibleScore: 40 }])).toEqual({ earnedPercent: 32, gradedWeightPercent: 40, projectedPercent: 80 });
  });
  it('does not approve candidate mappings unless their weights equal 100%', () => {
    expect(validateGradeWeights(categories)).toEqual({ total: 100, isApproved: true });
    expect(validateGradeWeights([{ id: 'quiz', name: 'Quizzes', weightPercent: 99 }])).toEqual({ total: 99, isApproved: false });
  });
});
