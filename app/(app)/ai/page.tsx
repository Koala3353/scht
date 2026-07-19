import { AiWorkbench } from '@/components/ai/ai-workbench';
import { PageHeader } from '@/components/workspace/page-header';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export default async function AiPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: profile }, { data: terms }, { data: subjects }, { data: projects }] = await Promise.all([
    supabase.from('profiles').select('current_term_id').eq('id', user.id).maybeSingle(),
    supabase.from('academic_terms').select('id, name, academic_year').eq('user_id', user.id).order('starts_on'),
    supabase.from('subjects').select('id, term_id, code, name').eq('user_id', user.id),
    supabase.from('projects').select('id, name, status').eq('user_id', user.id).order('created_at'),
  ]);
  return <main><PageHeader eyebrow="AI ASSISTANT" title="Propose, review, apply">Scht never writes to your tasks automatically. Review every suggested task before applying it.</PageHeader><AiWorkbench currentTermId={profile?.current_term_id ?? null} projects={(projects ?? []).map((project) => ({ id: project.id, label: project.name, status: project.status as 'active' | 'archived' }))} subjects={(subjects ?? []).map((subject) => ({ id: subject.id, termId: subject.term_id, label: `${subject.code} · ${subject.name}` }))} terms={(terms ?? []).map((term) => ({ id: term.id, label: `${term.name} ${term.academic_year}` }))} userId={user.id} /></main>;
}
