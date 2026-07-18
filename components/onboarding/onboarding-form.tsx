'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AcademicTermName } from '@/lib/curriculum/types';
import { createClient } from '@/lib/supabase/client';

const termStartMonth: Record<AcademicTermName, number> = { Intersession: 5, 'First Semester': 7, 'Second Semester': 0 };
const terms: AcademicTermName[] = ['Intersession', 'First Semester', 'Second Semester'];

export function OnboardingForm({ userId, defaultYear }: { userId: string; defaultYear: number }) {
  const router = useRouter();
  const [academicYear, setAcademicYear] = useState(String(defaultYear));
  const [termName, setTermName] = useState<AcademicTermName>('First Semester');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function saveTerm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const year = Number(academicYear);
    if (!Number.isInteger(year) || year < 2000 || year > 2200) { setError('Enter a valid academic-year start.'); return; }
    setIsSaving(true);
    setError('');
    const startsOn = new Date(Date.UTC(year, termStartMonth[termName], 1)).toISOString().slice(0, 10);
    const supabase = createClient();
    const { data: term, error: termError } = await supabase
      .from('academic_terms')
      .upsert({ user_id: userId, academic_year: year, name: termName, starts_on: startsOn }, { onConflict: 'user_id,starts_on' })
      .select('id')
      .single();
    if (termError || !term) { setError(termError?.message ?? 'Could not create your academic term.'); setIsSaving(false); return; }
    const { error: profileError } = await supabase.from('profiles').update({ current_term_id: term.id }).eq('id', userId);
    if (profileError) { setError(profileError.message); setIsSaving(false); return; }
    router.push('/onboarding?step=curriculum');
    router.refresh();
  }

  return <form className="mt-7 space-y-5" onSubmit={saveTerm}>
    <label className="block text-sm font-semibold" htmlFor="academic-year">Academic year starts</label>
    <input className="w-full rounded-xl border border-slate-300 px-4" id="academic-year" inputMode="numeric" max="2200" min="2000" onChange={(event) => setAcademicYear(event.target.value)} type="number" value={academicYear} />
    <label className="block text-sm font-semibold" htmlFor="term-name">Current term</label>
    <select className="w-full rounded-xl border border-slate-300 px-4" id="term-name" onChange={(event) => setTermName(event.target.value as AcademicTermName)} value={termName}>
      {terms.map((term) => <option key={term} value={term}>{term}</option>)}
    </select>
    <button className="w-full rounded-xl bg-teal px-5 font-bold text-white disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? 'Saving…' : 'Continue to curriculum import'}</button>
    {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
  </form>;
}
