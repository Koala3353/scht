'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TermOption, TermSwitcher } from './term-switcher';
import type { AcademicTermName } from '@/lib/curriculum/types';

interface CurrentTermControlProps { terms: TermOption[]; currentTermId: string; }

const termStartMonth: Record<AcademicTermName, number> = {
  Intersession: 5,
  'First Semester': 7,
  'Second Semester': 0,
};
const termStartYearOffset: Record<AcademicTermName, number> = {
  Intersession: 1,
  'First Semester': 0,
  'Second Semester': 1,
};
const termNames: AcademicTermName[] = ['Intersession', 'First Semester', 'Second Semester'];

export function CurrentTermControl({ terms, currentTermId }: CurrentTermControlProps) {
  const router = useRouter();
  const [value, setValue] = useState(currentTermId);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()));
  const [termName, setTermName] = useState<AcademicTermName>('First Semester');
  async function updateCurrentTerm(termId: string) {
    const previousValue = value;
    setValue(termId);
    setError('');
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error: updateError } = await supabase.from('profiles').update({ current_term_id: termId }).eq('id', user?.id ?? '');
    if (updateError) {
      setValue(previousValue);
      setError('Could not change the current academic term.');
      return;
    }
    router.refresh();
  }

  async function addTerm(makeCurrent: boolean) {
    const year = Number(academicYear);
    if (!Number.isInteger(year) || year < 2000 || year > 2200) {
      setError('Enter a valid academic-year start.');
      return;
    }
    setSaving(true);
    setError('');
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Sign in again before adding a term.');
      setSaving(false);
      return;
    }
    const startsOn = new Date(Date.UTC(year + termStartYearOffset[termName], termStartMonth[termName], 1)).toISOString().slice(0, 10);
    const { data: term, error: termError } = await supabase
      .from('academic_terms')
      .upsert({ user_id: user.id, academic_year: year, name: termName, starts_on: startsOn }, { onConflict: 'user_id,starts_on' })
      .select('id')
      .single();
    if (termError || !term) {
      setError(termError?.message ?? 'Could not add this academic term.');
      setSaving(false);
      return;
    }
    if (makeCurrent) {
      const { error: updateError } = await supabase.from('profiles').update({ current_term_id: term.id }).eq('id', user.id);
      if (updateError) {
        setError('Term was added, but it could not be selected.');
        setSaving(false);
        return;
      }
      setValue(term.id);
    }
    setAdding(false);
    setSaving(false);
    router.refresh();
  }

  return <div className="relative min-w-60"><TermSwitcher terms={terms} value={value} onChange={updateCurrentTerm} /><button className="mt-2 min-h-9 text-sm font-bold text-teal underline underline-offset-4" onClick={() => setAdding((current) => !current)} type="button">{adding ? 'Close term setup' : '+ Add academic term'}</button>{adding && <section className="absolute right-0 z-30 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl" aria-label="Add academic term"><p className="text-sm font-black text-ink">Add another term</p><p className="mt-1 text-xs leading-5 text-slate-600">Save it for later, or add and switch when your semester changes.</p><label className="mt-3 block text-xs font-bold text-ink">Academic year starts<input className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3" max="2200" min="2000" onChange={(event) => setAcademicYear(event.target.value)} type="number" value={academicYear} /></label><label className="mt-3 block text-xs font-bold text-ink">Term<select className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3" onChange={(event) => setTermName(event.target.value as AcademicTermName)} value={termName}>{termNames.map((term) => <option key={term} value={term}>{term}</option>)}</select></label><div className="mt-4 flex flex-wrap gap-2"><button className="min-h-10 rounded-lg border border-teal px-3 text-sm font-bold text-teal disabled:opacity-60" disabled={saving} onClick={() => void addTerm(false)} type="button">{saving ? 'Saving…' : 'Save term'}</button><button className="min-h-10 rounded-lg bg-teal px-3 text-sm font-bold text-white disabled:opacity-60" disabled={saving} onClick={() => void addTerm(true)} type="button">Save & switch</button></div></section>}{error && <p className="mt-1 text-sm text-red-700" role="alert">{error}</p>}</div>;
}
