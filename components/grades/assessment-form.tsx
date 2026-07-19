'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useToast } from '../feedback/toast-provider';

type Category = { id: string; subject_id: string; name: string; weight_percent: number };
type Subject = { id: string; code: string; name: string };

export function AssessmentForm({ categories, subjects }: { categories: Category[]; subjects: Subject[] }) {
  const { toast } = useToast();
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? ''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!notice) return;
    toast(notice, /could not|failed|did not|error|blocked/i.test(notice) ? "error" : "success");
  }, [notice, toast]);
  const visibleCategories = categories.filter((category) => category.subject_id === subjectId);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setNotice(''); const response = await fetch('/api/grades/results', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subjectId, categoryId: form.get('categoryId'), title: form.get('title'), score: Number(form.get('score')), possibleScore: Number(form.get('possibleScore')), assessedAt: form.get('assessedAt') || null }) }); const body = await response.json() as { error?: string }; setNotice(response.ok ? 'Assessment recorded. Refresh this page to update the summary.' : body.error ?? 'Could not record the assessment.'); setBusy(false); if (response.ok) event.currentTarget.reset(); }
  if (!subjects.length) return null;
  return <section className="mx-auto mt-6 max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Record an assessment</h2><p className="mt-1 text-sm text-slate-600">Only approved syllabus categories are available for grading.</p><form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submit}><label className="text-sm font-semibold">Subject<select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" onChange={(event) => setSubjectId(event.target.value)} value={subjectId}>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.code} — {subject.name}</option>)}</select></label><label className="text-sm font-semibold">Category<select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" name="categoryId" required>{visibleCategories.length ? visibleCategories.map((category) => <option key={category.id} value={category.id}>{category.name} ({category.weight_percent}%)</option>) : <option value="">Approve syllabus weights first</option>}</select></label><label className="text-sm font-semibold">Assessment title<input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" name="title" required /></label><label className="text-sm font-semibold">Date assessed<input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" name="assessedAt" type="date" /></label><label className="text-sm font-semibold">Score<input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" min="0" name="score" required step="0.01" type="number" /></label><label className="text-sm font-semibold">Possible score<input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" min="0.01" name="possibleScore" required step="0.01" type="number" /></label><button className="rounded-xl bg-action px-4 py-2 font-bold text-white disabled:opacity-60 sm:col-span-2" disabled={busy || visibleCategories.length === 0} type="submit">Save assessment</button></form>{notice && <p className="mt-3 text-sm text-slate-700" role="status">{notice}</p>}</section>;
}
