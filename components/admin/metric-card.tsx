interface MetricCardProps { label: string; value: number; description: string; }

export function MetricCard({ label, value, description }: MetricCardProps) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-bold text-teal">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight">{value.toLocaleString()}</p><p className="mt-2 text-sm text-slate-600">{description}</p></article>;
}
