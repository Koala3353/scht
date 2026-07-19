import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  GraduationCap,
  LayoutDashboard,
  Mail,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ProductTour } from "@/components/marketing/product-tour";
import { ConnectionFeatureSwitcher } from "@/components/marketing/connection-feature-switcher";

const workflow = [
  {
    title: "Bring the week together",
    body: "Sync Calendar, Gmail, and Canvas—or add the small things yourself. Every commitment lands where you can act on it.",
    icon: CalendarDays,
  },
  {
    title: "See the academic context",
    body: "Keep syllabi, grade categories, course notes, and assignment weight beside the work they affect.",
    icon: GraduationCap,
  },
  {
    title: "Move with confidence",
    body: "A focused daily view, thoughtful reminders, and reviewed AI proposals help you start the right thing next.",
    icon: Sparkles,
  },
];

export function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f6f8f8] text-ink">
      <section className="landing-hero relative isolate overflow-hidden bg-[#063f42] text-white">
        <div className="landing-orbit landing-orbit-one" />
        <div className="landing-orbit landing-orbit-two" />
        <nav
          aria-label="Primary"
          className="relative mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10"
        >
          <a className="flex items-center gap-2 text-xl font-black tracking-[-0.06em]" href="#top">
            <Image alt="" aria-hidden="true" height={30} priority src="/scht-mark.svg" width={30} />
            Scht<span className="text-[#f3b68b]">.</span>
          </a>
          <div className="hidden items-center gap-7 text-sm font-semibold text-teal-100 md:flex">
            <a className="transition hover:text-white" href="#workflow">
              How it works
            </a>
            <a className="transition hover:text-white" href="#tools">
              What it connects
            </a>
            <a className="transition hover:text-white" href="#questions">
              Questions
            </a>
          </div>
          <Link
            className="rounded-full border border-white/25 px-4 py-2 text-sm font-bold transition hover:border-white hover:bg-white hover:text-[#063f42]"
            href="/get-started"
          >
            Get started
          </Link>
        </nav>
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-12 sm:px-8 md:pb-28 md:pt-18 lg:grid-cols-[.94fr_1.06fr] lg:gap-16 lg:px-10">
          <div className="max-w-2xl">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-bold text-teal-50">
              <span className="h-1.5 w-1.5 rounded-full bg-[#f3b68b]" />
              Your academic life, in one considered place
            </p>
            <h1 className="max-w-xl text-5xl font-black leading-[.94] tracking-[-0.055em] text-wrap-balance sm:text-6xl lg:text-7xl">
              Less scramble.
              <br />
              <span className="text-[#c7e6dd]">More direction.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-teal-50/90 sm:text-xl">
              Scht is the private workspace for students who want deadlines,
              courses, grades, and real life to make sense together.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#f3b68b] px-5 py-3 font-bold text-[#3c2417] shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-[#ffd1ad]"
                href="/get-started"
              >
                Build your week{" "}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/22 px-5 py-3 font-bold text-white transition hover:bg-white/10"
                href="#workflow"
              >
                See the system <ChevronRight className="size-4" />
              </a>
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm text-teal-100">
              <ShieldCheck className="size-4 text-[#c7e6dd]" />
              Private by design. You decide what connects.
            </p>
          </div>
          <div
            aria-label="Preview of the Scht daily workspace"
            className="landing-float relative mx-auto w-full max-w-2xl"
          >
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-[#0c5659]/80 blur-2xl" />
            <div className="overflow-hidden rounded-[1.8rem] border border-white/20 bg-[#eef5f4] p-3 shadow-[0_28px_80px_rgba(0,0,0,.32)] sm:p-4">
              <div className="rounded-[1.25rem] bg-white p-4 text-ink sm:p-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <p className="text-xs font-bold text-teal">
                      TUESDAY · 14 OCT
                    </p>
                    <p className="mt-1 text-xl font-black tracking-tight">
                      A good day to begin.
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#e4f0ee] p-2 text-teal">
                    <LayoutDashboard className="size-5" />
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-[1.06fr_.94fr]">
                  <div className="space-y-3">
                    <article className="rounded-xl border border-[#c7e6dd] bg-[#eff8f6] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-teal">
                            NEXT UP · 10:00 AM
                          </p>
                          <h2 className="mt-1 font-bold">Problem set 3</h2>
                          <p className="mt-1 text-sm text-slate-600">
                            Applied Mathematics · 40 min
                          </p>
                        </div>
                        <span className="rounded-lg bg-[#f3b68b] px-2 py-1 text-xs font-black text-[#51321e]">
                          HIGH
                        </span>
                      </div>
                      <div className="mt-3 h-1.5 rounded-full bg-[#cbe2dd]">
                        <div className="h-1.5 w-2/3 rounded-full bg-teal" />
                      </div>
                    </article>
                    <article className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center gap-2">
                        <span className="grid size-7 place-items-center rounded-lg bg-[#f7ebe3] text-action">
                          <Mail className="size-4" />
                        </span>
                        <div>
                          <p className="font-bold">Reading list received</p>
                          <p className="text-xs text-slate-600">
                            Gmail · Added to your review list
                          </p>
                        </div>
                      </div>
                    </article>
                    <article className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center gap-2">
                        <span className="grid size-7 place-items-center rounded-lg bg-[#e8eef9] text-[#345d9d]">
                          <CalendarDays className="size-4" />
                        </span>
                        <div>
                          <p className="font-bold">Research methods seminar</p>
                          <p className="text-xs text-slate-600">
                            Google Calendar · 1:30 PM
                          </p>
                        </div>
                      </div>
                    </article>
                  </div>
                  <aside className="rounded-xl bg-[#083f42] p-4 text-white">
                    <p className="text-xs font-bold text-[#c7e6dd]">
                      YOUR STANDING
                    </p>
                    <p className="mt-5 text-4xl font-black tracking-[-.06em]">
                      91<span className="text-2xl text-[#c7e6dd]">%</span>
                    </p>
                    <p className="mt-1 text-sm text-teal-100">
                      Current average
                    </p>
                    <div className="mt-5 space-y-3 border-t border-white/15 pt-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-teal-100">Graded</span>
                        <strong>68%</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-teal-100">Next deadline</span>
                        <strong>2 days</strong>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
        <div className="max-w-3xl">
          <p className="text-sm font-bold text-teal">
            A calmer kind of capable
          </p>
          <h2 className="mt-4 text-4xl font-black tracking-[-.045em] text-wrap-balance sm:text-5xl">
            The planning tool that remembers why the task matters.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">
            A deadline is never just a deadline. It belongs to a class, a grade
            category, a schedule, and a life outside school. Scht holds that
            context without making your day feel crowded.
          </p>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-12">
          <article className="rounded-[2rem] bg-[#dceee9] p-6 lg:col-span-7 lg:p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h3 className="text-2xl font-black tracking-tight">
                  Your day, edited down
                </h3>
                <p className="mt-3 max-w-md leading-7 text-[#285356]">
                  Today puts the work with the most consequence first, then
                  leaves room for the quieter commitments that make a week
                  whole.
                </p>
              </div>
              <Clock3 className="size-8 shrink-0 text-teal" />
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-bold text-teal">10:00</p>
                <p className="mt-2 font-bold">Problem set</p>
                <p className="mt-1 text-sm text-slate-600">40 min focus</p>
              </div>
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-bold text-teal">13:30</p>
                <p className="mt-2 font-bold">Seminar</p>
                <p className="mt-1 text-sm text-slate-600">Calendar synced</p>
              </div>
              <div className="rounded-2xl bg-[#083f42] p-4 text-white">
                <p className="text-xs font-bold text-[#c7e6dd]">AFTER</p>
                <p className="mt-2 font-bold">Gym + reset</p>
                <p className="mt-1 text-sm text-teal-100">
                  Personal time stays visible
                </p>
              </div>
            </div>
          </article>
          <article className="rounded-[2rem] bg-[#253a57] p-6 text-white lg:col-span-5 lg:p-8">
            <UploadCloud className="size-8 text-[#f3b68b]" />
            <h3 className="mt-8 text-2xl font-black tracking-tight">
              Syllabi become usable.
            </h3>
            <p className="mt-3 leading-7 text-slate-200">
              Upload a syllabus, review its grade weights, then see assessment
              results reflect the categories you trust.
            </p>
            <div className="mt-7 rounded-2xl border border-white/15 bg-white/8 p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold">Assessment</span>
                <span className="text-[#f3b68b]">30%</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/15">
                <div className="h-2 w-[30%] rounded-full bg-[#f3b68b]" />
              </div>
              <p className="mt-3 text-sm text-slate-200">
                Reviewed before it affects your standing.
              </p>
            </div>
          </article>
        </div>
      </section>
      <section className="border-y border-slate-200 bg-white" id="workflow">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
          <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr]">
            <div>
              <h2 className="text-4xl font-black tracking-[-.045em] sm:text-5xl">
                Built around the way a real week unfolds.
              </h2>
              <p className="mt-5 max-w-md text-lg leading-8 text-slate-700">
                Not another inbox. A sequence that turns incoming work into a
                plan you can actually follow.
              </p>
              <Link
                className="mt-7 inline-flex items-center gap-2 font-bold text-teal underline decoration-teal/30 underline-offset-4 transition hover:decoration-teal"
                href="/get-started"
              >
                Start with your next deadline <ArrowRight className="size-4" />
              </Link>
            </div>
            <ol className="space-y-0 border-l border-slate-200">
              {workflow.map((item, index) => (
                <li className="relative pl-8 pb-10 last:pb-0" key={item.title}>
                  <span className="absolute -left-3 top-0 grid size-6 place-items-center rounded-full bg-[#083f42] text-xs font-black text-white">
                    {index + 1}
                  </span>
                  <item.icon className="size-6 text-teal" />
                  <h3 className="mt-3 text-xl font-black">{item.title}</h3>
                  <p className="mt-2 max-w-xl leading-7 text-slate-700">
                    {item.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
      <section
        className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-10"
        id="tools"
      >
        <div className="rounded-[2rem] bg-[#edf2f6] p-6 sm:p-10 lg:p-12">
          <div className="grid items-end gap-8 lg:grid-cols-[1fr_.8fr]">
            <div>
              <p className="text-sm font-bold text-[#345d9d]">
                A workspace that meets you where the work already is
              </p>
              <h2 className="mt-4 max-w-2xl text-4xl font-black tracking-[-.045em] sm:text-5xl">
                Connected when useful. Quiet when it is not.
              </h2>
            </div>
            <p className="max-w-md leading-7 text-slate-700">
              Import without surrendering control. Scht keeps every connection
              clear, reviewable, and scoped to the way you choose to work.
            </p>
          </div>
          <ConnectionFeatureSwitcher />
        </div>
      </section>
      <ProductTour />
      <section
        className="bg-[#083f42] px-5 py-20 text-white sm:px-8 sm:py-28 lg:px-10"
        id="access"
      >
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-bold text-[#c7e6dd]">
              Ready when your semester is
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-[-.045em] text-wrap-balance sm:text-5xl">
              Make room for the work that matters.
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-8 text-teal-100">
              Join Scht with an invite, connect only what helps, and start with
              the next thing that deserves your attention.
            </p>
            <ul className="mt-8 space-y-3 text-teal-50">
              {[
                "Invite-only workspace access",
                "Works beautifully from phone to desktop",
                "No automatic AI changes—ever",
              ].map((item) => (
                <li className="flex items-center gap-3" key={item}>
                  <Check className="size-5 text-[#f3b68b]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[2rem] bg-white p-6 text-ink shadow-2xl sm:p-8">
            <p className="text-sm font-bold text-teal">START HERE</p>
            <h3 className="mt-2 text-3xl font-black tracking-tight">
              Your week has a home.
            </h3>
            <p className="mt-3 leading-7 text-slate-700">
              Use your school email to request your secure sign-in link.
            </p>
            <Link
              className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal px-4 py-3 font-bold text-white transition hover:bg-[#064c4e]"
              href="/get-started"
            >
              Continue to secure access <ArrowRight className="size-4" />
            </Link>
            <p className="mt-4 text-center text-sm text-slate-600">
              New to Scht? You will need an invite to create your workspace.
            </p>
          </div>
        </div>
      </section>
      <footer className="bg-[#083f42] px-5 pb-7 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-white/15 pt-6 text-sm text-teal-100 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Scht. Planning with context.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link className="font-bold text-white transition hover:text-[#f3b68b]" href="/privacy">Privacy</Link>
            <Link className="font-bold text-white transition hover:text-[#f3b68b]" href="/terms">Terms</Link>
            <a className="font-bold text-white transition hover:text-[#f3b68b]" href="#top">Back to top</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
