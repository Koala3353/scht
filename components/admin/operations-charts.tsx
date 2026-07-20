type ActivityPoint = { label: string; tasks: number; emails: number };

type OperationsChartsProps = {
  activity: ActivityPoint[];
  connections: { connected: number; attention: number; disconnected: number };
  deliveries: { sent: number; failed: number; pending: number };
  tasks: { open: number; completed: number };
};

function total(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0);
}

function Meter({ label, value, totalValue, className }: { label: string; value: number; totalValue: number; className: string }) {
  const width = totalValue > 0 ? Math.max(4, Math.round((value / totalValue) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="font-black text-slate-950">{value}</span>
      </div>
      <div aria-hidden="true" className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${className}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function OperationsCharts({ activity, connections, deliveries, tasks }: OperationsChartsProps) {
  const activityMax = Math.max(1, ...activity.flatMap((point) => [point.tasks, point.emails]));
  const connectionTotal = total([connections.connected, connections.attention, connections.disconnected]);
  const deliveryTotal = total([deliveries.sent, deliveries.failed, deliveries.pending]);
  const taskTotal = total([tasks.open, tasks.completed]);

  return (
    <section aria-label="Workspace operations charts" className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_.85fr_.85fr]">
      <article className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold tracking-[.14em] text-teal">7-DAY ACTIVITY</p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">Task and email volume</h2>
          </div>
          <p className="text-xs leading-5 text-slate-500">Tasks created · email delivery attempts</p>
        </div>
        <div className="mt-6 grid h-44 grid-cols-7 items-end gap-2" role="img" aria-label="Daily task and email activity for the past seven days">
          {activity.map((point) => (
            <div className="flex h-full min-w-0 flex-col justify-end gap-1" key={point.label}>
              <div className="flex h-36 items-end justify-center gap-1">
                <span aria-label={`${point.tasks} tasks`} className="w-2 rounded-t bg-teal transition" style={{ height: `${Math.max(point.tasks ? 8 : 0, Math.round((point.tasks / activityMax) * 100))}%` }} />
                <span aria-label={`${point.emails} emails`} className="w-2 rounded-t bg-action transition" style={{ height: `${Math.max(point.emails ? 8 : 0, Math.round((point.emails / activityMax) * 100))}%` }} />
              </div>
              <span className="truncate text-center text-[10px] font-bold text-slate-500">{point.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-slate-600">
          <span><i aria-hidden="true" className="mr-2 inline-block size-2 rounded-sm bg-teal" />Tasks created</span>
          <span><i aria-hidden="true" className="mr-2 inline-block size-2 rounded-sm bg-action" />Email attempts</span>
        </div>
      </article>

      <article className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-extrabold tracking-[.14em] text-blue-700">CONNECTION HEALTH</p>
        <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">Provider status</h2>
        <div className="mt-6 space-y-4">
          <Meter className="bg-teal" label="Connected" totalValue={connectionTotal} value={connections.connected} />
          <Meter className="bg-red-500" label="Needs attention" totalValue={connectionTotal} value={connections.attention} />
          <Meter className="bg-slate-400" label="Disconnected" totalValue={connectionTotal} value={connections.disconnected} />
        </div>
      </article>

      <article className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-extrabold tracking-[.14em] text-action">DELIVERY + WORK</p>
        <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">Operational balance</h2>
        <div className="mt-6 space-y-4">
          <Meter className="bg-teal" label="Emails sent" totalValue={deliveryTotal} value={deliveries.sent} />
          <Meter className="bg-red-500" label="Email failures" totalValue={deliveryTotal} value={deliveries.failed} />
          <Meter className="bg-[#345d9d]" label="Open tasks" totalValue={taskTotal} value={tasks.open} />
          <Meter className="bg-[#7caa9b]" label="Completed tasks" totalValue={taskTotal} value={tasks.completed} />
        </div>
      </article>
    </section>
  );
}
