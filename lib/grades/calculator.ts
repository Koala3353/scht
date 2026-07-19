export interface GradeCategory {
  id: string;
  name: string;
  weightPercent: number;
}
export interface AssessmentResult {
  categoryId: string;
  score: number;
  possibleScore: number;
}

export interface GradeSummary {
  earnedPercent: number;
  gradedWeightPercent: number;
  projectedPercent: number | null;
}
export type AcademicScale = "qpi" | "gpa";
export interface CourseGrade {
  subjectId: string;
  units: number;
  percentage: number | null;
}
export interface AcademicIndex {
  value: number | null;
  countedUnits: number;
  courses: Array<CourseGrade & { point: number; letter: string }>;
}

export function validateGradeWeights(categories: GradeCategory[]) {
  const total = categories.reduce(
    (sum, category) => sum + category.weightPercent,
    0,
  );
  return { total, isApproved: Math.abs(total - 100) < 0.001 };
}

export function calculateGrade(
  categories: GradeCategory[],
  results: AssessmentResult[],
): GradeSummary {
  const byCategory = new Map<string, AssessmentResult[]>();
  for (const result of results)
    byCategory.set(result.categoryId, [
      ...(byCategory.get(result.categoryId) ?? []),
      result,
    ]);
  let earnedWeight = 0;
  let gradedWeight = 0;
  for (const category of categories) {
    const categoryResults = byCategory.get(category.id) ?? [];
    const possible = categoryResults.reduce(
      (sum, result) => sum + result.possibleScore,
      0,
    );
    if (possible <= 0) continue;
    const score = categoryResults.reduce(
      (sum, result) => sum + result.score,
      0,
    );
    earnedWeight += category.weightPercent * (score / possible);
    gradedWeight += category.weightPercent;
  }
  return {
    earnedPercent: Math.round(earnedWeight * 100) / 100,
    gradedWeightPercent: gradedWeight,
    projectedPercent:
      gradedWeight > 0
        ? Math.round((earnedWeight / gradedWeight) * 10000) / 100
        : null,
  };
}

export function ateneoQpiEquivalent(percentage: number) {
  if (percentage >= 92) return { letter: "A", point: 4 };
  if (percentage >= 86) return { letter: "B+", point: 3.5 };
  if (percentage >= 77) return { letter: "B", point: 3 };
  if (percentage >= 69) return { letter: "C+", point: 2.5 };
  if (percentage >= 60) return { letter: "C", point: 2 };
  if (percentage >= 50) return { letter: "D", point: 1 };
  return { letter: "F", point: 0 };
}

export function calculateAcademicIndex(
  courses: CourseGrade[],
  scale: AcademicScale,
): AcademicIndex {
  const gradedCourses = courses.flatMap((course) => {
    if (course.percentage === null || course.units <= 0) return [];
    const qpi = ateneoQpiEquivalent(course.percentage);
    const point =
      scale === "qpi"
        ? qpi.point
        : Math.min(
            4,
            Math.max(0, Math.round((course.percentage / 25) * 100) / 100),
          );
    const letter = scale === "qpi" ? qpi.letter : `${point.toFixed(2)} / 4.00`;
    return [{ ...course, point, letter }];
  });
  const countedUnits = gradedCourses.reduce(
    (total, course) => total + course.units,
    0,
  );
  const qualityPoints = gradedCourses.reduce(
    (total, course) => total + course.point * course.units,
    0,
  );
  return {
    value:
      countedUnits > 0
        ? Math.round((qualityPoints / countedUnits) * 100) / 100
        : null,
    countedUnits,
    courses: gradedCourses,
  };
}
