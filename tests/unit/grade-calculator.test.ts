import { describe, expect, it } from "vitest";
import {
  ateneoQpiEquivalent,
  calculateAcademicIndex,
  calculateGrade,
  validateGradeWeights,
} from "../../lib/grades/calculator";

describe("grade calculation", () => {
  const categories = [
    { id: "quiz", name: "Quizzes", weightPercent: 40 },
    { id: "exam", name: "Exams", weightPercent: 60 },
  ];
  it("calculates earned and projected standing from approved category weights", () => {
    expect(
      calculateGrade(categories, [
        { categoryId: "quiz", score: 32, possibleScore: 40 },
      ]),
    ).toEqual({
      earnedPercent: 32,
      gradedWeightPercent: 40,
      projectedPercent: 80,
    });
  });
  it("does not approve candidate mappings unless their weights equal 100%", () => {
    expect(validateGradeWeights(categories)).toEqual({
      total: 100,
      isApproved: true,
    });
    expect(
      validateGradeWeights([
        { id: "quiz", name: "Quizzes", weightPercent: 99 },
      ]),
    ).toEqual({ total: 99, isApproved: false });
  });
  it("uses Ateneo quality points and course units for QPI", () => {
    expect(ateneoQpiEquivalent(92)).toEqual({ letter: "A", point: 4 });
    expect(ateneoQpiEquivalent(86)).toEqual({ letter: "B+", point: 3.5 });
    expect(
      calculateAcademicIndex(
        [
          { subjectId: "math", units: 3, percentage: 92 },
          { subjectId: "writing", units: 1, percentage: 86 },
        ],
        "qpi",
      ),
    ).toMatchObject({ value: 3.88, countedUnits: 4 });
  });
  it("offers a units-weighted four-point GPA estimate", () => {
    expect(
      calculateAcademicIndex(
        [
          { subjectId: "math", units: 3, percentage: 90 },
          { subjectId: "writing", units: 1, percentage: 80 },
        ],
        "gpa",
      ),
    ).toMatchObject({ value: 3.5, countedUnits: 4 });
  });
  it("caps GPA estimates at four points", () => {
    expect(
      calculateAcademicIndex(
        [{ subjectId: "extra-credit", units: 3, percentage: 105 }],
        "gpa",
      ),
    ).toMatchObject({ value: 4 });
  });
});
