"use client";

import { useMemo, useState, type FormEvent } from 'react';
import { inspectIps, type ParsedCurriculumItem } from '../../lib/curriculum/ips-parser';
import type { AcademicTermName } from '../../lib/curriculum/types';
import { createClient } from '../../lib/supabase/client';

interface IpsImportProps {
  termId: string;
  termLabel: string;
  academicYear: number;
  termName: AcademicTermName;
  canvasConnected: boolean;
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

export function IpsImport({ academicYear, canvasConnected, termId, termLabel, termName }: IpsImportProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualUnits, setManualUnits] = useState('3');
  const [isSavingManual, setIsSavingManual] = useState(false);
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
          else {
            let canvasMessage = '';
            if (canvasConnected) {
              const canvasResponse = await fetch('/api/integrations/canvas', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action: 'sync' }),
              });
              const canvasResult = await canvasResponse.json().catch(() => ({})) as { linkedCourses?: number; unmatchedCourses?: number; error?: string };
              canvasMessage = canvasResponse.ok
                ? ` ${canvasResult.linkedCourses ?? 0} Canvas course${canvasResult.linkedCourses === 1 ? '' : 's'} linked automatically${canvasResult.unmatchedCourses ? `; ${canvasResult.unmatchedCourses} unmatched course${canvasResult.unmatchedCourses === 1 ? '' : 's'} stayed out of your subjects.` : '.'}`
                : ' IPS subjects were saved, but Canvas could not be linked automatically. Sync Canvas again from Settings.';
            }
            setSuccess(`Imported ${selectedRows.length} IPS course${selectedRows.length === 1 ? '' : 's'} and activated their subject workspaces for ${termLabel}.${canvasMessage}`);
          }
        }
      }
    }
    setIsImporting(false);
  }

  async function addManualSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = manualCode.trim().toUpperCase();
    const name = manualName.trim();
    const units = Number(manualUnits);
    if (!code || !name || !Number.isFinite(units) || units <= 0 || units > 30) {
      setError('Enter a course code, name, and units between 0 and 30.');
      return;
    }
    setError('');
    setSuccess('');
    setIsSavingManual(true);
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setError(userError?.message ?? 'Sign in again before adding a subject.');
      setIsSavingManual(false);
      return;
    }
    const { data: existingSubject, error: existingSubjectError } = await supabase
      .from('subjects')
      .select('id')
      .eq('user_id', user.id)
      .eq('term_id', termId)
      .ilike('code', code)
      .maybeSingle();
    if (existingSubjectError) {
      setError('Could not check your existing subjects.');
      setIsSavingManual(false);
      return;
    }
    const { data: subject, error: subjectError } = existingSubject
      ? { data: existingSubject, error: null }
      : await supabase.from('subjects').insert({ user_id: user.id, term_id: termId, code, name, units }).select('id').single();
    if (subjectError || !subject) {
      setError(subjectError?.message ?? 'Could not add this subject.');
      setIsSavingManual(false);
      return;
    }
    const { data: existingItem, error: itemReadError } = await supabase
      .from('curriculum_items')
      .select('id')
      .eq('user_id', user.id)
      .eq('academic_year', academicYear)
      .eq('term', termName)
      .eq('course_code', code)
      .maybeSingle();
    const itemResult = itemReadError
      ? { error: itemReadError }
      : existingItem
        ? await supabase.from('curriculum_items').update({ subject_id: subject.id, term_id: termId }).eq('id', existingItem.id)
        : await supabase.from('curriculum_items').insert({ user_id: user.id, term_id: termId, subject_id: subject.id, academic_year: academicYear, term: termName, status: 'Manual', course_code: code, course_title: name, units, category: 'Manual', required: false, prerequisite_override: false, import_source: 'manual' });
    if (itemResult.error) {
      setError('Subject added, but its curriculum link could not be saved. Try again.');
    } else {
      setManualCode('');
      setManualName('');
      setManualUnits('3');
      let canvasMessage = '';
      if (canvasConnected) {
        const canvasResponse = await fetch('/api/integrations/canvas', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'sync' }),
        });
        const canvasResult = await canvasResponse.json().catch(() => ({})) as { linkedCourses?: number };
        canvasMessage = canvasResponse.ok
          ? ` ${canvasResult.linkedCourses ?? 0} Canvas course${canvasResult.linkedCourses === 1 ? '' : 's'} linked automatically.`
          : ' The subject was saved, but Canvas could not be linked automatically. Sync Canvas again from Settings.';
      }
      setSuccess(`${code} was added as a manual subject for ${termLabel}.${canvasMessage}`);
    }
    setIsSavingManual(false);
  }

  return <section aria-labelledby="curriculum-import-heading" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <p className="text-sm font-bold tracking-[.12em] text-teal">CURRICULUM IMPORT</p>
    <h2 className="mt-2 text-2xl font-bold" id="curriculum-import-heading">Preview your IPS courses</h2>
    <p className="mt-3 text-slate-600">Active term: <strong>{termLabel}</strong>. Choose the program year from your IPS, then import only that year and semester. Canvas can link to these IPS subjects, but it never creates extra subjects on its own.</p>
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
    <form className="mt-8 border-t border-slate-200 pt-6" id="manual-subject" onSubmit={(event) => void addManualSubject(event)}>
      <p className="text-sm font-bold tracking-[.12em] text-teal">MANUAL FALLBACK</p>
      <h3 className="mt-2 text-xl font-bold">Add a subject not present in your IPS</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">Use this for late adds, special topics, or an IPS parsing exception. It is still saved as a curriculum item and can auto-link to Canvas by course code.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-semibold">Course code<input className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3" maxLength={32} onChange={(event) => setManualCode(event.target.value)} required value={manualCode} /></label>
        <label className="text-sm font-semibold sm:col-span-2">Course name<input className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3" maxLength={180} onChange={(event) => setManualName(event.target.value)} required value={manualName} /></label>
        <label className="text-sm font-semibold">Units<input className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3" max="30" min="0.5" onChange={(event) => setManualUnits(event.target.value)} required step="0.5" type="number" value={manualUnits} /></label>
      </div>
      <button className="mt-4 min-h-11 rounded-xl border border-teal px-5 font-bold text-teal transition hover:bg-[#e6f2f0] disabled:cursor-not-allowed disabled:opacity-60" disabled={isSavingManual} type="submit">{isSavingManual ? 'Adding subject…' : 'Add manual subject'}</button>
    </form>
  </section>;
}
