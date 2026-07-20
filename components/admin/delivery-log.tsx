"use client";

import { useMemo, useState } from "react";

export type DeliveryEvent = {
  id: string;
  recipient: string;
  kind: "Task reminder" | "Scheduled update";
  status: "sent" | "failed" | "pending";
  occurredAt: string;
  detail: string;
};

const statusStyle = {
  sent: "bg-[#e6f2f0] text-teal",
  failed: "bg-red-50 text-red-800",
  pending: "bg-[#e8eef9] text-[#345d9d]",
};

function timestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function DeliveryLog({ deliveries }: { deliveries: DeliveryEvent[] }) {
  const [filter, setFilter] = useState<"all" | DeliveryEvent["status"]>("all");
  const [query, setQuery] = useState("");
  const visible = useMemo(
    () => deliveries.filter((delivery) =>
      (filter === "all" || delivery.status === filter) &&
      `${delivery.recipient} ${delivery.detail} ${delivery.kind}`.toLowerCase().includes(query.trim().toLowerCase()),
    ),
    [deliveries, filter, query],
  );

  return (
    <section aria-labelledby="delivery-log-heading" className="mt-6 rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-extrabold tracking-[.14em] text-action">EMAIL DELIVERY LOG</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950" id="delivery-log-heading">Recent emails and delivery attempts</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Task reminders and scheduled updates are retained here for operational debugging.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="delivery-search">Search delivery history</label>
          <input className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/10" id="delivery-search" onChange={(event) => setQuery(event.target.value)} placeholder="Search recipient or subject" value={query} />
          <label className="sr-only" htmlFor="delivery-status">Filter delivery status</label>
          <select className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold outline-none transition focus:border-teal" id="delivery-status" onChange={(event) => setFilter(event.target.value as typeof filter)} value={filter}>
            <option value="all">All statuses</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {visible.length === 0 ? <p className="mt-5 rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-600">No delivery records match this filter yet.</p> : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-y border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3 font-extrabold">Recipient</th><th className="px-3 py-3 font-extrabold">Message</th><th className="px-3 py-3 font-extrabold">Status</th><th className="px-3 py-3 font-extrabold">Time</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((delivery) => <tr key={delivery.id}><td className="px-3 py-4 font-bold text-slate-950">{delivery.recipient}</td><td className="px-3 py-4"><p className="font-semibold text-slate-800">{delivery.kind}</p><p className="mt-1 max-w-md text-slate-600">{delivery.detail}</p></td><td className="px-3 py-4"><span className={`rounded-full px-3 py-1.5 text-xs font-extrabold capitalize ${statusStyle[delivery.status]}`}>{delivery.status}</span></td><td className="px-3 py-4 whitespace-nowrap text-slate-600"><time dateTime={delivery.occurredAt}>{timestamp(delivery.occurredAt)}</time></td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
