'use client';

import { FormEvent, useState } from 'react';

type Notice = { kind: 'error' | 'success'; text: string } | null;

export function IntegrationsPanel() {
  const [canvasUrl, setCanvasUrl] = useState('');
  const [canvasToken, setCanvasToken] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  async function canvas(action: 'connect' | 'sync', event?: FormEvent) {
    event?.preventDefault(); setBusy(true); setNotice(null);
    const response = await fetch('/api/integrations/canvas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, baseUrl: canvasUrl, token: canvasToken }) });
    const body = await response.json() as { error?: string; courses?: number; assignments?: number; };
    setNotice(response.ok ? { kind: 'success', text: action === 'connect' ? `Canvas connected. ${body.courses ?? 0} active courses found.` : `Canvas sync complete. ${body.assignments ?? 0} assignments imported.` } : { kind: 'error', text: body.error ?? 'Canvas request failed.' });
    setBusy(false);
  }
  async function syncGoogle() {
    setBusy(true); setNotice(null);
    const response = await fetch('/api/integrations/google/sync', { method: 'POST' });
    const body = await response.json() as { error?: string; calendarEvents?: number; gmailTasks?: number; };
    setNotice(response.ok ? { kind: 'success', text: `Google sync complete. ${body.calendarEvents ?? 0} calendar events and ${body.gmailTasks ?? 0} Gmail tasks imported.` } : { kind: 'error', text: body.error ?? 'Google sync failed.' });
    setBusy(false);
  }
  return <section className="mt-6 grid gap-5 lg:grid-cols-2"><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Google Calendar and Gmail</h2><p className="mt-2 text-sm text-slate-600">Connect once, then import upcoming events and unread messages on demand. Reconnect if Google revokes access.</p><div className="mt-4 flex flex-wrap gap-3"><a className="rounded-xl bg-teal px-4 py-2 font-bold text-white" href="/api/integrations/google/start">Connect Google</a><button className="rounded-xl border border-teal px-4 py-2 font-bold text-teal disabled:opacity-60" disabled={busy} onClick={syncGoogle} type="button">Sync Google</button></div></article><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Canvas</h2><p className="mt-2 text-sm text-slate-600">Your personal Canvas API token is encrypted before it is stored. Canvas courses are matched to the selected term and assignments become tasks.</p><form className="mt-4 space-y-3" onSubmit={(event) => void canvas('connect', event)}><label className="block text-sm font-semibold">Canvas base URL<input className="mt-1 w-full rounded-xl border border-slate-300 px-3" onChange={(event) => setCanvasUrl(event.target.value)} placeholder="https://canvas.example.edu" required type="url" value={canvasUrl} /></label><label className="block text-sm font-semibold">Canvas API token<input className="mt-1 w-full rounded-xl border border-slate-300 px-3" onChange={(event) => setCanvasToken(event.target.value)} required type="password" value={canvasToken} /></label><div className="flex flex-wrap gap-3"><button className="rounded-xl bg-action px-4 py-2 font-bold text-white disabled:opacity-60" disabled={busy} type="submit">Connect Canvas</button><button className="rounded-xl border border-teal px-4 py-2 font-bold text-teal disabled:opacity-60" disabled={busy} onClick={() => void canvas('sync')} type="button">Sync assignments</button></div></form></article>{notice && <p className={notice.kind === 'error' ? 'text-sm text-red-700' : 'text-sm text-teal'} role="status">{notice.text}</p>}</section>;
}
