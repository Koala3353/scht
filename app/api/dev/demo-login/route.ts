import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const demoEmail = 'adminadminadmin@demo.scht.local';

function enabled() { return process.env.NODE_ENV === 'development' && process.env.DEMO_AUTH_ENABLED === 'true'; }

async function seedDemoWorkspace(userId: string) {
  const supabase = createAdminClient();
  const year = new Date().getFullYear();
  const { data: existingTerm } = await supabase.from('academic_terms').select('id').eq('user_id', userId).order('starts_on').limit(1).maybeSingle();
  const term = existingTerm ?? (await supabase.from('academic_terms').insert({ user_id: userId, academic_year: year, name: 'First Semester', starts_on: `${year}-08-01`, ends_on: `${year}-12-20` }).select('id').single()).data;
  if (!term) throw new Error('Could not create the demo academic term.');
  await supabase.from('profiles').upsert({ id: userId, display_name: 'Scht demo user', current_term_id: term.id, onboarding_completed_at: new Date().toISOString() });
  const { data: currentSubjects } = await supabase.from('subjects').select('id, code').eq('user_id', userId).eq('term_id', term.id);
  if ((currentSubjects ?? []).length > 0) return;
  const { data: subjects, error: subjectError } = await supabase.from('subjects').insert([{ user_id: userId, term_id: term.id, code: 'MATH 101', name: 'Applied Mathematics', syllabus_status: 'missing' }, { user_id: userId, term_id: term.id, code: 'ENG 110', name: 'Academic Writing', syllabus_status: 'missing' }]).select('id, code');
  if (subjectError || !subjects) throw new Error(subjectError?.message ?? 'Could not create demo subjects.');
  const math = subjects.find((subject) => subject.code === 'MATH 101'); const writing = subjects.find((subject) => subject.code === 'ENG 110');
  await supabase.from('tasks').insert([{ user_id: userId, term_id: term.id, subject_id: math?.id ?? null, title: 'Problem set 3', kind: 'school', priority: 'high', due_at: new Date(Date.now() + 2 * 86_400_000).toISOString(), source: 'demo' }, { user_id: userId, term_id: term.id, subject_id: writing?.id ?? null, title: 'Draft thesis outline', kind: 'school', priority: 'normal', due_at: new Date(Date.now() + 4 * 86_400_000).toISOString(), source: 'demo' }]);
}

export async function GET(request: NextRequest) {
  if (!enabled()) return new NextResponse('Not found.', { status: 404 });
  try {
    const supabase = createAdminClient();
    const { error: createError } = await supabase.auth.admin.createUser({ email: demoEmail, email_confirm: true, user_metadata: { name: 'Scht demo admin' } });
    if (createError && !/already|exists|registered/i.test(createError.message)) throw createError;
    const { data: link, error: linkError } = await supabase.auth.admin.generateLink({ type: 'magiclink', email: demoEmail, options: { redirectTo: new URL('/auth/callback', request.url).toString() } });
    if (linkError || !link.properties?.action_link || !link.user) throw linkError ?? new Error('Could not generate the demo sign-in link.');
    await seedDemoWorkspace(link.user.id);
    return NextResponse.redirect(link.properties.action_link);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Demo sign-in failed.' }, { status: 500 }); }
}
