import { PageHeader } from '@/components/workspace/page-header';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export default async function CalendarPage() {
  const user = await requireUser(); const supabase = await createClient();
  const [{ data: tasks }, { data: events }] = await Promise.all([
    supabase.from('tasks').select('id, title, due_at, kind').eq('user_id', user.id).not('due_at', 'is', null).order('due_at').limit(50),
    supabase.from('calendar_events').select('id, title, starts_at, ends_at, is_all_day, event_url, provider').eq('user_id', user.id).order('starts_at').limit(100),
  ]);
  const entries = [...(tasks ?? []).map((task) => ({ id: `task-${task.id}`, title: task.title, at: task.due_at, detail: task.kind, url: null })), ...(events ?? []).map((event) => ({ id: `event-${event.id}`, title: event.title, at: event.starts_at, detail: event.provider === 'google_calendar' ? 'Google Calendar' : event.provider, url: event.event_url }))].sort((left, right) => new Date(left.at ?? 0).getTime() - new Date(right.at ?? 0).getTime());
  return <main><PageHeader eyebrow="CALENDAR" title="Scheduled work">Task deadlines and imported Google Calendar events share one time-ordered view.</PageHeader><section className="mx-auto mt-6 max-w-5xl space-y-3 px-4 sm:px-0">{entries.map((entry) => <article className="rounded-2xl border border-slate-200 bg-white p-4" key={entry.id}><time className="font-bold text-teal" dateTime={entry.at ?? undefined}>{entry.at ? new Date(entry.at).toLocaleString() : 'Unscheduled'}</time><h2 className="mt-1 font-bold">{entry.title}</h2><p className="text-sm text-slate-600">{entry.detail}{entry.url && <> · <a className="font-semibold text-teal underline" href={entry.url} rel="noreferrer" target="_blank">Open event</a></>}</p></article>)}{!entries.length && <p className="text-slate-600">No scheduled tasks or imported events yet.</p>}</section></main>;
}
