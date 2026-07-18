import Link from 'next/link';

export default function Home() {
  return <main className="grid min-h-screen place-items-center p-6"><section className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"><p className="text-sm font-bold tracking-[.16em] text-teal">SCHOOL + WORK, IN FLOW</p><h1 className="mt-3 text-4xl font-bold tracking-tight text-ink">Scht is getting ready.</h1><p className="mt-4 text-slate-600">Your invite-only planner will bring deadlines, subjects, work, and grades into one calm daily view.</p><Link className="mt-7 inline-flex items-center rounded-xl bg-teal px-5 py-3 font-bold text-white" href="/today">Open workspace</Link></section></main>;
}
