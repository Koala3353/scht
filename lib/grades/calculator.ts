export interface GradeCategory { id: string; name: string; weightPercent: number; }
export interface AssessmentResult { categoryId: string; score: number; possibleScore: number; }

export interface GradeSummary { earnedPercent: number; gradedWeightPercent: number; projectedPercent: number | null; }

export function validateGradeWeights(categories: GradeCategory[]) {
  const total = categories.reduce((sum, category) => sum + category.weightPercent, 0);
  return { total, isApproved: Math.abs(total - 100) < 0.001 };
}

export function calculateGrade(categories: GradeCategory[], results: AssessmentResult[]): GradeSummary {
  const byCategory = new Map<string, AssessmentResult[]>();
  for (const result of results) byCategory.set(result.categoryId, [...(byCategory.get(result.categoryId) ?? []), result]);
  let earnedWeight = 0;
  let gradedWeight = 0;
  for (const category of categories) {
    const categoryResults = byCategory.get(category.id) ?? [];
    const possible = categoryResults.reduce((sum, result) => sum + result.possibleScore, 0);
    if (possible <= 0) continue;
    const score = categoryResults.reduce((sum, result) => sum + result.score, 0);
    earnedWeight += category.weightPercent * (score / possible);
    gradedWeight += category.weightPercent;
  }
  return { earnedPercent: Math.round(earnedWeight * 100) / 100, gradedWeightPercent: gradedWeight, projectedPercent: gradedWeight > 0 ? Math.round((earnedWeight / gradedWeight) * 10000) / 100 : null };
}
