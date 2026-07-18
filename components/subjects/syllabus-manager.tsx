'use client';

import { FormEvent, useMemo, useState } from 'react';

type Weight = { name: string; weightPercent: number };
type Syllabus = { id: string; candidate_weights: Weight[]; validation_state: string } | null;

export function SyllabusManager({ subjectId, syllabus: initialSyllabus }: { subjectId: string; syllabus: Syllabus }) {
  const [syllabus, setSyllabus] = useState(initialSyllabus);
  const [weights, setWeights] = useState<Weight[]>(initialSyllabus?.candidate_weights ?? []);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const total = useMemo(() => weights.reduce((sum, weight) => sum + Number(weight.weightPercent || 0), 0), [weights]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget); form.set('subjectId', subjectId);
    setBusy(true); setNotice('');
    const response = await fetch('/api/syllabi', { method: 'POST', body: form });
    const body = await response.json() as { error?: string; id?: string; candidate_weights?: Weight[]; validation_state?: string };
    if (response.ok && body.id) { const next = { id: body.id, candidate_weights: body.candidate_weights ?? [], validation_state: body.validation_state ?? 'pending' }; setSyllabus(next); setWeights(next.candidate_weights); setNotice(next.candidate_weights.length ? 'Extracted grade weights are ready for your review.' : 'Syllabus uploaded. Add the grade categories from your syllabus below.'); }
    else setNotice(body.error ?? 'Could not upload the syllabus.');
    setBusy(false);
  }
  function updateWeight(index: number, field: keyof Weight, value: string) { setWeights((current) => current.map((weight, itemIndex) => itemIndex === index ? { ...weight, [field]: field === 'weightPercent' ? Number(value) : value } : weight)); }
  async function approve() {
    if (!syllabus) return;
    setBusy(true); setNotice('');
    const response = await fetch('/api/grades/approve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subjectId, syllabusId: syllabus.id, weights }) });
    const body = await response.json() as { error?: string };
    setNotice(response.ok ? 'Grade categories approved and now used in your grade summary.' : body.error ?? 'Could not approve grade categories.');
    if (response.ok) setSyllabus({ ...syllabus, candidate_weights: weights, validation_state: 'approved' });
    setBusy(false);
  }
  return <section className="mt-5 border-t border-slate-200 pt-4"><h3 className="font-bold">Syllabus and grade weights</h3><form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={upload}><label className="min-w-52 flex-1 text-sm font-semibold">Syllabus file<input accept=".txt,.md,.csv,.pdf,.doc,.docx" className="mt-1 block w-full text-sm" name="file" required type="file" /></label><button className="rounded-xl bg-action px-4 py-2 font-bold text-white disabled:opacity-60" disabled={busy} type="submit">Upload syllabus</button></form>{syllabus && <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-700">Status: <strong>{syllabus.validation_state.replace('_', ' ')}</strong></p><div className="space-y-2">{weights.map((weight, index) => <div className="grid grid-cols-[1fr_6rem] gap-2" key={`${weight.name}-${index}`}><input aria-label={`Category ${index + 1}`} className="rounded-lg border border-slate-300 px-2 py-1" onChange={(event) => updateWeight(index, 'name', event.target.value)} value={weight.name} /><input aria-label={`Weight for ${weight.name}`} className="rounded-lg border border-slate-300 px-2 py-1" min="0" onChange={(event) => updateWeight(index, 'weightPercent', event.target.value)} step="0.01" type="number" value={weight.weightPercent} /></div>)}</div><div className="flex flex-wrap items-center gap-3"><button className="rounded-lg border border-teal px-3 py-1.5 text-sm font-bold text-teal" onClick={() => setWeights((current) => [...current, { name: 'New category', weightPercent: 0 }])} type="button">Add category</button><span className={total === 100 ? 'text-sm font-bold text-teal' : 'text-sm font-bold text-red-700'}>Total: {total}%</span><button className="rounded-lg bg-teal px-3 py-1.5 text-sm font-bold text-white disabled:opacity-60" disabled={busy || total !== 100 || weights.length === 0} onClick={() => void approve()} type="button">Approve weights</button></div></div>}{notice && <p className="mt-3 text-sm text-slate-700" role="status">{notice}</p>}</section>;
}
