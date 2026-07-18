import { PageHeader } from '@/components/workspace/page-header';
import { IntegrationsPanel } from '@/components/settings/integrations-panel';

const sections = ['Integrations — Google Calendar, Gmail, and Canvas connections', 'AI vault — encrypted OpenAI or Hack Club AI provider keys', 'Reminders — time zone, quiet hours, and delivery preferences', 'Data — export, retention, and account controls'];
export default function SettingsPage() { return <main><PageHeader eyebrow="SETTINGS" title="Your workspace controls">Connections expose a clear status: connected, syncing, needs reauthorization, or error.</PageHeader><IntegrationsPanel /><section className="mt-5 max-w-5xl space-y-3">{sections.slice(1).map((section) => <article className="rounded-2xl border border-slate-200 bg-white p-5" key={section}><p className="font-bold">{section}</p></article>)}</section></main>; }
