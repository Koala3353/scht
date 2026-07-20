'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { FileUp } from 'lucide-react';
import { useToast } from '../feedback/toast-provider';

type Weight = { name: string; weightPercent: number };
type Syllabus = { id: string; candidate_weights: Weight[]; validation_state: string } | null;

export function SyllabusManager({ subjectId, syllabus: initialSyllabus }: { subjectId: string; syllabus: Syllabus }) {
  const { toast } = useToast();
  const [syllabus, setSyllabus] = useState(initialSyllabus);
  const [weights, setWeights] = useState<Weight[]>(initialSyllabus?.candidate_weights ?? []);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  useEffect(() => {
    if (!notice) return;
    toast(notice, /could not|failed|did not|error|blocked/i.test(notice) ? "error" : "success");
  }, [notice, toast]);
  const total = useMemo(() => weights.reduce((sum, weight) => sum + Number(weight.weightPercent || 0), 0), [weights]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement); form.set('subjectId', subjectId);
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/syllabi', { method: 'POST', body: form });
      const body = await response.json().catch(() => ({})) as { error?: string; id?: string; candidate_weights?: Weight[]; validation_state?: string };
      if (response.ok && body.id) {
        const next = { id: body.id, candidate_weights: body.candidate_weights ?? [], validation_state: body.validation_state ?? 'pending' };
        setSyllabus(next); setWeights(next.candidate_weights); setSelectedFileName(''); formElement.reset();
        setNotice(next.candidate_weights.length ? 'Extracted grade weights are ready for your review.' : 'Syllabus uploaded. PDF and text files are checked for grade weights; add or edit categories below if needed.');
      } else setNotice(body.error ?? 'Could not upload the syllabus.');
    } catch {
      setNotice('Could not upload the syllabus. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
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
  return <section className="mt-5 border-t border-slate-200 pt-4"><h3 className="font-bold">Syllabus and grade weights</h3><p className="mt-1 text-xs text-slate-600">Upload a private syllabus to extract reviewable grade weights. PDF, document, text, and CSV files up to 10 MB are supported.</p><form className="mt-4 flex flex-wrap items-center gap-3" onSubmit={upload}><input accept=".txt,.md,.csv,.pdf,.doc,.docx" className="sr-only" id={`syllabus-file-${subjectId}`} name="file" onChange={(event) => setSelectedFileName(event.target.files?.[0]?.name ?? '')} required type="file" /><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-teal px-4 py-2 text-sm font-bold text-teal transition hover:bg-[#e6f2f0]" htmlFor={`syllabus-file-${subjectId}`}><FileUp aria-hidden="true" className="size-4" />Browse syllabus files</label><span className="min-w-40 flex-1 text-sm text-slate-600" aria-live="polite">{selectedFileName || 'No file selected'}</span><button className="min-h-11 rounded-xl bg-action px-4 py-2 font-bold text-white transition hover:bg-[#8d3909] disabled:cursor-not-allowed disabled:opacity-60" disabled={busy || !selectedFileName} type="submit">{busy ? 'Processing syllabus…' : 'Upload and process'}</button></form>{syllabus && <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-700">Status: <strong>{syllabus.validation_state.replace('_', ' ')}</strong></p>{syllabus.validation_state !== 'approved' ? <p className="text-sm text-action">Extraction needs review before its weights affect your standing.</p> : null}<div className="space-y-2">{weights.map((weight, index) => <div className="grid grid-cols-[1fr_6rem] gap-2" key={`${weight.name}-${index}`}><input aria-label={`Category ${index + 1}`} className="rounded-lg border border-slate-300 px-2 py-1" onChange={(event) => updateWeight(index, 'name', event.target.value)} value={weight.name} /><input aria-label={`Weight for ${weight.name}`} className="rounded-lg border border-slate-300 px-2 py-1" min="0" onChange={(event) => updateWeight(index, 'weightPercent', event.target.value)} step="0.01" type="number" value={weight.weightPercent} /></div>)}</div><div className="flex flex-wrap items-center gap-3"><button className="rounded-lg border border-teal px-3 py-1.5 text-sm font-bold text-teal" onClick={() => setWeights((current) => [...current, { name: 'New category', weightPercent: 0 }])} type="button">Add category</button><span className={total === 100 ? 'text-sm font-bold text-teal' : 'text-sm font-bold text-red-700'}>Approved weights: {total}%</span><button className="rounded-lg bg-teal px-3 py-1.5 text-sm font-bold text-white disabled:opacity-60" disabled={busy || total !== 100 || weights.length === 0} onClick={() => void approve()} type="button">Approve weights</button></div></div>}{notice && <p className="mt-3 text-sm text-slate-700" role="status">{notice}</p>}</section>;
}
