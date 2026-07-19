export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading your workspace" className="mx-auto max-w-5xl px-4 py-8 sm:px-0">
      <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-9 w-64 animate-pulse rounded bg-slate-200" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <div className="h-36 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" key={index} />
        ))}
      </div>
    </main>
  );
}
