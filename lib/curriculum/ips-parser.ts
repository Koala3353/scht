import type { AcademicTermName } from './types';

export interface ParsedCurriculumItem {
  programYear: number;
  term: AcademicTermName;
  status: string;
  courseCode: string;
  units: number;
  category: string;
  required: boolean;
  prerequisiteOverride: boolean;
}

export interface IpsParseResult {
  rows: ParsedCurriculumItem[];
  invalidLineCount: number;
}

const yearNumbers: Record<string, number> = {
  First: 1,
  Second: 2,
  Third: 3,
  Fourth: 4,
};

const termNames = [
  'Intersession',
  'First Semester',
  'Second Semester',
] as const satisfies readonly AcademicTermName[];

function parseBoolean(value: string): boolean | null {
  if (value === 'Y') return true;
  if (value === 'N') return false;
  return null;
}

function parseRow(
  line: string,
  programYear: number | null,
  term: AcademicTermName | null,
): ParsedCurriculumItem | null {
  if (programYear === null || term === null) return null;

  const tokens = line.trim().split(/\s+/);
  if (tokens.length < 6) return null;

  const prerequisiteOverride = parseBoolean(tokens.at(-1) ?? '');
  const required = parseBoolean(tokens.at(-2) ?? '');
  const category = tokens.at(-3) ?? '';
  const units = Number(tokens.at(-4));
  const status = tokens[0] ?? '';
  const courseCode = tokens.slice(1, -4).join(' ');

  if (
    prerequisiteOverride === null ||
    required === null ||
    category.length === 0 ||
    !Number.isFinite(units) ||
    units < 0 ||
    status.length === 0 ||
    courseCode.length === 0
  ) {
    return null;
  }

  return {
    programYear,
    term,
    status,
    courseCode,
    units,
    category,
    required,
    prerequisiteOverride,
  };
}

/**
 * Parses the tabular course rows in a pasted Individual Program of Study (IPS).
 * It intentionally ignores headings and total lines, and only accepts rows with
 * a recognized requirement and prerequisite-override flag.
 */
export function inspectIps(input: string): IpsParseResult {
  const rows: ParsedCurriculumItem[] = [];
  let invalidLineCount = 0;
  let currentYear: number | null = null;
  let currentTerm: AcademicTermName | null = null;

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^Units Taken\s*:/i.test(line) || /^Status\b.*\bUnits\b.*\bRequired\?/i.test(line)) continue;

    const yearMatch = /^(First|Second|Third|Fourth)\s+Year$/i.exec(line);
    if (yearMatch) {
      const ordinal = yearMatch[1];
      const yearName = ordinal.charAt(0).toUpperCase() + ordinal.slice(1).toLowerCase();
      currentYear = yearNumbers[yearName] ?? null;
      continue;
    }

    const matchedTerm = termNames.find((candidate) => candidate.toLowerCase() === line.toLowerCase());
    if (matchedTerm) {
      currentTerm = matchedTerm;
      continue;
    }

    const row = parseRow(line, currentYear, currentTerm);
    if (row) rows.push(row);
    else invalidLineCount += 1;
  }

  return { rows, invalidLineCount };
}

export function parseIps(input: string): ParsedCurriculumItem[] {
  return inspectIps(input).rows;
}
