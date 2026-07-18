export type AcademicTermName =
  | 'Intersession'
  | 'First Semester'
  | 'Second Semester';

export type TaskKind = 'school' | 'work' | 'personal';
export type TaskPriority = 'low' | 'normal' | 'high';

export interface AcademicTerm {
  id: string;
  userId: string;
  academicYear: number;
  name: AcademicTermName;
  startsOn: string;
  endsOn: string | null;
}

export interface Subject {
  id: string;
  userId: string;
  termId: string;
  code: string;
  name: string;
}

export interface CurriculumItem {
  id: string;
  userId: string;
  termId: string;
  subjectId: string | null;
  courseCode: string;
  courseTitle: string | null;
  units: number;
  category: string | null;
  required: boolean;
  prerequisiteOverride: boolean;
}
