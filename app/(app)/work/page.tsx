import { PageHeader } from '@/components/workspace/page-header';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export default async function WorkPage() { const user = await requireUser(); const supabase = await createClient(); const { data: projects } = await supabase.from('projects').select('id, name, status').eq('user_id', user.id).eq('status', 'active'); return <main><PageHeader eyebrow="WORK" title="Projects and tasks">Work commitments appear in Today while their project context stays here.</PageHeader><section className="mx-auto mt-6 max-w-5xl space-y-3 px-4 sm:px-0">{(projects ?? []).map((project) => <article className="rounded-2xl border border-slate-200 bg-white p-5" key={project.id}><h2 className="font-bold">{project.name}</h2><p className="mt-1 text-sm text-slate-600">{project.status}</p></article>)}{!projects?.length && <p className="text-slate-600">No active projects yet.</p>}</section></main>; }
