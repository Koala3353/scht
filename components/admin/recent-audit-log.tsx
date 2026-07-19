interface AuditEntry { id: number; action: string; target_table: string; created_at: string; }

export function RecentAuditLog({ entries }: { entries: AuditEntry[] }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Recent owner activity</h2>{entries.length === 0 ? <p className="mt-3 text-sm text-slate-600">No audited owner actions have been recorded.</p> : <ol className="mt-3 divide-y divide-slate-100">{entries.map((entry) => <li className="flex items-center justify-between gap-4 py-3 text-sm" key={entry.id}><span><b>{entry.action}</b> · {entry.target_table}</span><time className="shrink-0 text-slate-600" dateTime={entry.created_at}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.created_at))}</time></li>)}</ol>}</section>;
}
