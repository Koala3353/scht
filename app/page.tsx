import { InviteAuthForm } from '@/components/auth/invite-auth-form';

export default function Home() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-bold tracking-[.16em] text-teal">SCHOOL + WORK, IN FLOW</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink">Welcome to Scht.</h1>
        <p className="mt-4 text-slate-600">Scht is an invite-only planner for deadlines, subjects, work, and grades.</p>
        <InviteAuthForm />
      </section>
    </main>
  );
}
