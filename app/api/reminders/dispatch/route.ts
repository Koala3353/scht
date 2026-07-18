import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

function authorized(request: Request) {
  const expected = process.env.REMINDER_DISPATCH_TOKEN;
  return Boolean(expected && request.headers.get('authorization') === `Bearer ${expected}`);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data: reminders, error } = await supabase.from('reminder_queue').select('id, user_id, task_id, send_at, idempotency_key, tasks(title, due_at)').eq('status', 'pending').lte('send_at', now).order('send_at').limit(25);
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  const jobs = await Promise.all((reminders ?? []).map(async (reminder) => {
    const { data } = await supabase.auth.admin.getUserById(reminder.user_id);
    return { id: reminder.id, idempotencyKey: reminder.idempotency_key, email: data.user?.email, title: (reminder.tasks as { title?: string } | null)?.title ?? 'Upcoming task', dueAt: (reminder.tasks as { due_at?: string | null } | null)?.due_at ?? null };
  }));
  return NextResponse.json({ jobs: jobs.filter((job) => job.email) });
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const body = await request.json().catch(() => null) as { reminderId?: string; idempotencyKey?: string; success?: boolean; error?: string } | null;
  if (!body?.reminderId || !body.idempotencyKey) return NextResponse.json({ error: 'Reminder acknowledgement is required.' }, { status: 400 });
  const supabase = createAdminClient();
  const status = body.success ? 'delivered' : 'pending';
  const update = body.success ? { status, attempts: 1, deferred_reason: null } : { status, deferred_reason: body.error ?? 'Delivery failed', attempts: 1 };
  const { error } = await supabase.from('reminder_queue').update(update).eq('id', body.reminderId).eq('idempotency_key', body.idempotencyKey);
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  if (body.success) await supabase.from('reminder_deliveries').upsert({ reminder_id: body.reminderId, provider: 'apps_script', idempotency_key: body.idempotencyKey, delivered_at: new Date().toISOString() }, { onConflict: 'idempotency_key' });
  return NextResponse.json({ acknowledged: true });
}
