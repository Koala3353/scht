import { PageHeader } from '@/components/workspace/page-header';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export default async function SubjectsPage() {
  const user = await requireUser(); const supabase = await createClient();
  const { data: profile } = await supabase.from('profiles').select('current_term_id').eq('id', user.id).maybeSingle();
  const { data: subjects } = profile?.current_term_id ? await supabase.from('subjects').select('id, code, name, professor_notes, syllabus_status').eq('term_id', profile.current_term_id).is('archived_at', null).order('code') : { data: [] };
  return <main><PageHeader eyebrow="CURRENT TERM" title="Subjects">Course notes, syllabus review, Canvas state, and grade progress stay grouped by class.</PageHeader><section className="mx-auto mt-6 grid max-w-5xl gap-4 px-4 sm:grid-cols-2 sm:px-0">{(subjects ?? []).map((subject) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={subject.id}><p className="font-bold text-teal">{subject.code}</p><h2 className="mt-1 text-lg font-bold">{subject.name}</h2><p className="mt-3 text-sm text-slate-600">{subject.professor_notes || 'No professor notes yet.'}</p><p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">Syllabus: {subject.syllabus_status}</p></article>)}</section>{!subjects?.length && <p className="mx-auto mt-8 max-w-5xl px-4 text-slate-600 sm:px-0">Activate curriculum items during onboarding to start building your subject workspace.</p>}</main>;
}
