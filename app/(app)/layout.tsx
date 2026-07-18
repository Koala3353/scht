import { CurrentTermControl } from '@/components/layout/current-term-control';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import type { AcademicTermName } from '@/lib/curriculum/types';

const termNames: Record<AcademicTermName, string> = {
  Intersession: 'Intersession',
  'First Semester': 'First Semester',
  'Second Semester': 'Second Semester',
};

export default async function AuthenticatedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: profile }, { data: terms }] = await Promise.all([
    supabase.from('profiles').select('current_term_id').eq('id', user.id).maybeSingle(),
    supabase.from('academic_terms').select('id, academic_year, name').eq('user_id', user.id).order('academic_year', { ascending: false }),
  ]);
  const options = (terms ?? []).map((term) => ({
    id: term.id,
    label: `${term.academic_year}–${term.academic_year + 1} · ${termNames[term.name as AcademicTermName]}`,
  }));

  return <main className="min-h-screen p-4 sm:p-6">
    <header className="mx-auto mb-8 flex max-w-5xl items-end justify-between gap-4">
      <p className="text-2xl font-bold text-teal">Scht</p>
      {profile?.current_term_id && options.length > 0 && <CurrentTermControl currentTermId={profile.current_term_id} terms={options} />}
    </header>
    {children}
  </main>;
}
