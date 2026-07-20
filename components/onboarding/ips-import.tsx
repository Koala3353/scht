"use client";

import { useMemo, useState } from 'react';
import { inspectIps, type ParsedCurriculumItem } from '../../lib/curriculum/ips-parser';
import type { AcademicTermName } from '../../lib/curriculum/types';
import { createClient } from '../../lib/supabase/client';

interface IpsImportProps {
  termId: string;
  termLabel: string;
  academicYear: number;
  termName: AcademicTermName;
}

function RequirementFlag({ value }: { value: boolean }) {
  return <span>{value ? 'Yes' : 'No'}</span>;
}

function PreviewRows({ rows }: { rows: ParsedCurriculumItem[] }) {
  if (rows.length === 0) {
    return <p className="mt-5 text-sm text-slate-600">No courses from the selected term are ready to import.</p>;
  }

  return <div className="mt-5 overflow-x-auto">
    <table className="min-w-full text-left text-sm">
      <caption className="sr-only">Courses parsed for the selected academic term</caption>
      <thead className="border-b border-slate-200 text-slate-600">
        <tr>
          <th className="px-3 py-2 font-semibold" scope="col">Status</th>
          <th className="px-3 py-2 font-semibold" scope="col">Course</th>
          <th className="px-3 py-2 font-semibold" scope="col">Units</th>
          <th className="px-3 py-2 font-semibold" scope="col">Category</th>
          <th className="px-3 py-2 font-semibold" scope="col">Required</th>
          <th className="px-3 py-2 font-semibold" scope="col">Override</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => <tr className="border-b border-slate-100" key={`${row.courseCode}-${row.status}`}>
          <td className="px-3 py-3">{row.status}</td>
          <td className="px-3 py-3 font-semibold">{row.courseCode}</td>
          <td className="px-3 py-3">{row.units}</td>
          <td className="px-3 py-3">{row.category}</td>
          <td className="px-3 py-3"><RequirementFlag value={row.required} /></td>
          <td className="px-3 py-3"><RequirementFlag value={row.prerequisiteOverride} /></td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

export function IpsImport({ academicYear, termId, termLabel, termName }: IpsImportProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [programYear, setProgramYear] = useState(1);
  const parsed = useMemo(() => inspectIps(input), [input]);
  const programYears = useMemo(
    () => [...new Set(parsed.rows.map((row) => row.programYear))].sort((left, right) => left - right),
    [parsed.rows],
  );
  const selectedProgramYear = programYears.includes(programYear) ? programYear : (programYears[0] ?? 1);
  const selectedRows = useMemo(
    () => parsed.rows.filter((row) => row.programYear === selectedProgramYear && row.term === termName),
    [parsed.rows, selectedProgramYear, termName],
  );

  async function importCourses() {
    if (selectedRows.length === 0) return;

    setError('');
    setSuccess('');
    setIsImporting(true);
    const supabase = createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setError(userError?.message ?? 'Sign in again before importing your curriculum.');
      setIsImporting(false);
      return;
    }

    const { data: curriculumItems, error: importError } = await supabase.from('curriculum_items').upsert(
      selectedRows.map((row) => ({
        user_id: userData.user.id,
        term_id: termId,
        academic_year: academicYear,
        term: row.term,
        status: row.status,
        course_code: row.courseCode,
        units: row.units,
        category: row.category,
        required: row.required,
        prerequisite_override: row.prerequisiteOverride,
        import_source: 'ips',
      })),
      { onConflict: 'user_id,academic_year,term,course_code' },
    ).select('id, course_code');

    if (importError) setError(importError.message);
    else {
      const { data: existingSubjects, error: subjectReadError } = await supabase
        .from('subjects')
        .select('id, code')
        .eq('user_id', userData.user.id)
        .eq('term_id', termId);
      if (subjectReadError) setError('Curriculum was saved, but we could not activate its subject workspaces.');
      else {
        const existingByCode = new Map((existingSubjects ?? []).map((subject) => [subject.code.trim().toLowerCase(), subject.id]));
        const missingSubjects = selectedRows.filter((row) => !existingByCode.has(row.courseCode.trim().toLowerCase()));
        const { data: insertedSubjects, error: subjectInsertError } = missingSubjects.length
          ? await supabase.from('subjects').insert(missingSubjects.map((row) => ({ user_id: userData.user.id, term_id: termId, code: row.courseCode, name: row.courseCode, units: row.units }))).select('id, code')
          : { data: [], error: null };
        if (subjectInsertError) setError('Curriculum was saved, but we could not activate its subject workspaces.');
        else {
          for (const subject of insertedSubjects ?? []) existingByCode.set(subject.code.trim().toLowerCase(), subject.id);
          const linkingResults = await Promise.all((curriculumItems ?? []).flatMap((item) => {
            const subjectId = existingByCode.get(item.course_code.trim().toLowerCase());
            return subjectId ? [supabase.from('curriculum_items').update({ subject_id: subjectId }).eq('id', item.id)] : [];
          }));
          const linkingError = linkingResults.find((result) => result.error)?.error;
          if (linkingError) setError('Curriculum and subjects were saved, but their links could not be completed. Try importing again.');
          else setSuccess(`Imported ${selectedRows.length} course${selectedRows.length === 1 ? '' : 's'} and activated their subject workspaces for ${termLabel}.`);
        }
      }
    }
    setIsImporting(false);
  }

  return <section aria-labelledby="curriculum-import-heading" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <p className="text-sm font-bold tracking-[.12em] text-teal">CURRICULUM IMPORT</p>
    <h2 className="mt-2 text-2xl font-bold" id="curriculum-import-heading">Preview your IPS courses</h2>
    <p className="mt-3 text-slate-600">Active term: <strong>{termLabel}</strong>. Paste the tabular portion of your IPS below; nothing is saved until you import the reviewable preview.</p>
    <label className="mt-6 block text-sm font-semibold" htmlFor="ips-input">Paste IPS</label>
    <textarea className="mt-2 min-h-48 w-full rounded-xl border border-slate-300 p-3 font-mono text-sm" id="ips-input" onChange={(event) => setInput(event.target.value)} placeholder={'First Year\nFirst Semester\nP ENLIT 12 3 C Y N'} value={input} />
    {programYears.length > 0 && (
      <label className="mt-4 block max-w-xs text-sm font-semibold" htmlFor="program-year">
        Program year
        <select className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-ink" id="program-year" onChange={(event) => setProgramYear(Number(event.target.value))} value={selectedProgramYear}>
          {programYears.map((year) => <option key={year} value={year}>Year {year}</option>)}
        </select>
      </label>
    )}
    <p aria-live="polite" className="mt-3 text-sm text-slate-600">Parsed {parsed.rows.length} course{parsed.rows.length === 1 ? '' : 's'} · {parsed.invalidLineCount} invalid line{parsed.invalidLineCount === 1 ? '' : 's'} · Selected program year: Year {selectedProgramYear} · Review {selectedRows.length} item{selectedRows.length === 1 ? '' : 's'} for {termLabel} before import.</p>
    <PreviewRows rows={selectedRows} />
    <button className="mt-6 min-h-11 rounded-xl bg-orange px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={isImporting || selectedRows.length === 0} onClick={importCourses} type="button">
      {isImporting ? 'Importing…' : `Import ${selectedRows.length} course${selectedRows.length === 1 ? '' : 's'}`}
    </button>
    {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
    {success && <p className="mt-3 text-sm text-teal" role="status">{success}</p>}
  </section>;
}
