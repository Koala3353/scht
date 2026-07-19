import { ArrowLeft, BookOpenCheck, LockKeyhole, Sparkles } from "lucide-react";
import Link from "next/link";
import { InviteAuthForm } from "@/components/auth/invite-auth-form";

export default function GetStartedPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#edf3f2] text-ink">
      <div className="relative mx-auto grid min-h-screen max-w-[96rem] lg:grid-cols-[.9fr_1.1fr]">
        <section className="relative overflow-hidden bg-[#083f42] px-6 py-7 text-white sm:px-10 lg:px-14 lg:py-12">
          <div className="absolute -right-44 top-16 size-[32rem] rounded-full border border-white/15" />
          <div className="absolute -bottom-56 -left-28 size-[34rem] rounded-full border border-white/10" />
          <div className="relative flex h-full flex-col">
            <Link
              className="inline-flex items-center gap-2 self-start text-sm font-bold text-teal-100 transition hover:text-white"
              href="/"
            >
              <ArrowLeft className="size-4" />
              Back to Scht
            </Link>
            <div className="my-auto max-w-lg py-16 lg:py-0">
              <p className="text-xl font-black tracking-[-.06em]">
                Scht<span className="text-[#f3b68b]">.</span>
              </p>
              <h1 className="mt-8 text-5xl font-black leading-[.95] tracking-[-.055em] text-wrap-balance sm:text-6xl">
                A steadier semester starts here.
              </h1>
              <p className="mt-6 text-lg leading-8 text-teal-100">
                Your workspace is private, considered, and ready to connect the
                parts of student life that usually live apart.
              </p>
              <div className="mt-10 space-y-5 border-t border-white/15 pt-7">
                {[
                  [
                    BookOpenCheck,
                    "Plan with course context",
                    "Syllabi, grade categories, and deadlines belong together.",
                  ],
                  [
                    Sparkles,
                    "Review every AI suggestion",
                    "Scht never writes to your planner without your approval.",
                  ],
                  [
                    LockKeyhole,
                    "Keep control of connections",
                    "Link Google, Gmail, or Canvas only when it helps.",
                  ],
                ].map(([Icon, title, detail]) => {
                  const FeatureIcon = Icon as typeof BookOpenCheck;
                  return (
                    <div className="flex gap-4" key={title as string}>
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-[#f3b68b]">
                        <FeatureIcon className="size-5" />
                      </span>
                      <div>
                        <p className="font-bold">{title as string}</p>
                        <p className="mt-1 text-sm leading-6 text-teal-100">
                          {detail as string}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-sm text-teal-100">
              Invite-only access · Built for individual students
            </p>
          </div>
        </section>
        <section className="flex items-center px-5 py-10 sm:px-10 lg:px-16">
          <div className="mx-auto w-full max-w-xl">
            <p className="text-sm font-bold text-teal">JOIN OR RETURN</p>
            <h2 className="mt-3 text-4xl font-black tracking-[-.05em]">
              Your academic life, gathered.
            </h2>
            <p className="mt-4 max-w-lg leading-7 text-slate-700">
              Use your school email to receive a secure sign-in link. New
              students need an invite; returning students can use the same flow
              to pick up where they left off.
            </p>
            <div className="mt-8 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(23,34,51,.08)] sm:p-8">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
                <span className="grid size-10 place-items-center rounded-xl bg-[#e4f0ee] font-black text-teal">
                  S
                </span>
                <div>
                  <p className="font-black">Sign in or sign up</p>
                  <p className="text-sm text-slate-600">
                    One secure link. No password to remember.
                  </p>
                </div>
              </div>
              <InviteAuthForm />
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-600">
              By continuing, you are asking Scht to send a secure authentication
              link to the email you provide.
              {" "}Read the <Link className="font-bold text-teal underline underline-offset-2" href="/privacy">Privacy Policy</Link>
              {" "}and <Link className="font-bold text-teal underline underline-offset-2" href="/terms">Terms of Service</Link>.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
