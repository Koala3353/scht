import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function validTime(value: unknown) { return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
function timeAt(date: Date, time: string, timezone: string) {
  const [hours, minutes] = time.split(':').map(Number); const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const parts = Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const localUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hours, minutes);
  const offset = new Date(localUtc).toLocaleString('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' }).match(/GMT([+-]\d{1,2})(?::(\d{2}))?/) ?? ['GMT+0', '+0', '00'];
  const offsetMinutes = Number(offset[1]) * 60 + (Number(offset[1]) < 0 ? -Number(offset[2] ?? 0) : Number(offset[2] ?? 0));
  return new Date(localUtc - offsetMinutes * 60_000);
}
function outsideQuietHours(sendAt: Date, quietStart: string | null, quietEnd: string | null, timezone: string) {
  if (!quietStart || !quietEnd || quietStart === quietEnd) return sendAt;
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }); const local = formatter.format(sendAt);
  const within = quietStart < quietEnd ? local >= quietStart && local < quietEnd : local >= quietStart || local < quietEnd;
  if (!within) return sendAt;
  const next = timeAt(sendAt, quietEnd, timezone); return next <= sendAt ? new Date(next.getTime() + 24 * 60 * 60 * 1000) : next;
}
export async function POST(request: Request) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const body = await request.json().catch(() => null) as { timezone?: string; quietStart?: string | null; quietEnd?: string | null; enabled?: boolean; digestWindowDays?: number; digestEnabled?: boolean; digestTime?: string; digestFrequency?: "daily" | "weekly"; digestWeekday?: number } | null;
  if (!body?.timezone || (body.quietStart && !validTime(body.quietStart)) || (body.quietEnd && !validTime(body.quietEnd))) return NextResponse.json({ error: 'Use an IANA time zone and valid quiet-hour times.' }, { status: 400 });
  const digestWindowDays = Number(body.digestWindowDays ?? 3);
  const digestTime = body.digestTime ?? '07:00';
  if (body.digestFrequency && !["daily", "weekly"].includes(body.digestFrequency)) return NextResponse.json({ error: 'Choose a valid email cadence.' }, { status: 400 });
  const digestFrequency = body.digestFrequency === "weekly" ? "weekly" : "daily";
  const digestWeekday = Number(body.digestWeekday ?? 1);
  if (![1, 3, 7, 14].includes(digestWindowDays)) return NextResponse.json({ error: 'Choose a 1, 3, 7, or 14-day email timeline.' }, { status: 400 });
  if (digestFrequency === "weekly" && digestWindowDays < 7) return NextResponse.json({ error: 'Weekly updates need a 7- or 14-day outlook.' }, { status: 400 });
  if (!validTime(digestTime)) return NextResponse.json({ error: 'Choose a valid delivery time.' }, { status: 400 });
  if (!Number.isInteger(digestWeekday) || digestWeekday < 0 || digestWeekday > 6) return NextResponse.json({ error: 'Choose a valid weekly delivery day.' }, { status: 400 });
  try { Intl.DateTimeFormat(undefined, { timeZone: body.timezone }); } catch { return NextResponse.json({ error: 'Use a valid IANA time zone, such as Asia/Manila.' }, { status: 400 }); }
  const { error } = await supabase.from('reminder_preferences').upsert({ user_id: user.id, timezone: body.timezone, quiet_start: body.quietStart ?? null, quiet_end: body.quietEnd ?? null, enabled: body.enabled !== false, digest_window_days: digestWindowDays, digest_enabled: body.digestEnabled === true, digest_time: digestTime, digest_frequency: digestFrequency, digest_weekday: digestWeekday }, { onConflict: 'user_id' });
  return error ? NextResponse.json({ error: error.message }, { status: 502 }) : NextResponse.json({ saved: true });
}
export async function PUT(request: Request) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const body = await request.json().catch(() => null) as { taskId?: string } | null; if (!body?.taskId) return NextResponse.json({ error: 'taskId is required.' }, { status: 400 });
  const [{ data: task }, { data: preferences }] = await Promise.all([supabase.from('tasks').select('id, due_at').eq('id', body.taskId).eq('user_id', user.id).is('completed_at', null).maybeSingle(), supabase.from('reminder_preferences').select('enabled').eq('user_id', user.id).maybeSingle()]);
  if (!task?.due_at) return NextResponse.json({ error: 'Only an open task with a due date can receive a reminder.' }, { status: 400 }); if (preferences?.enabled === false) return NextResponse.json({ error: 'Enable reminders in settings before scheduling one.' }, { status: 400 });
  const dueAt = new Date(task.due_at); const { data: fullPreferences } = await supabase.from('reminder_preferences').select('timezone, quiet_start, quiet_end').eq('user_id', user.id).maybeSingle(); const sendAt = outsideQuietHours(new Date(dueAt.getTime() - 60 * 60 * 1000), fullPreferences?.quiet_start ?? null, fullPreferences?.quiet_end ?? null, fullPreferences?.timezone ?? 'UTC'); if (sendAt <= new Date() || sendAt >= dueAt) return NextResponse.json({ error: 'This task cannot receive a reminder outside your quiet hours before its due time.' }, { status: 400 });
  const { data, error } = await supabase.from('reminder_queue').insert({ user_id: user.id, task_id: task.id, send_at: sendAt.toISOString(), idempotency_key: crypto.randomUUID() }).select('id, send_at').single();
  return error ? NextResponse.json({ error: error.message }, { status: 502 }) : NextResponse.json({ reminder: data, sendAt: data.send_at }, { status: 201 });
}
