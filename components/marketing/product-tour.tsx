import {
  BellRing,
  BookOpenText,
  Check,
  CircleHelp,
  Sparkles,
} from "lucide-react";

const questions = [
  [
    "Do I need to connect every service?",
    "No. Scht works as a focused manual planner first. Connect Google Calendar, Gmail, or Canvas only when the import is useful to you.",
  ],
  [
    "How does grade tracking work?",
    "Upload a syllabus, review the extracted category weights, approve the mapping, and then record assessments against the categories you trust.",
  ],
  [
    "What does AI have permission to do?",
    "AI can make a proposal from the context you provide. Nothing enters your planner until you review the suggested tasks and explicitly apply them.",
  ],
  [
    "Can I use Scht on my phone?",
    "Yes. The core workspace is designed to remain clear from a compact phone view through a full desktop planning session.",
  ],
];

export function ProductTour() {
  return (
    <>
      <section
        className="border-t border-slate-200 bg-white px-5 py-20 sm:px-8 sm:py-28 lg:px-10"
        id="screens"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[.78fr_1.22fr] lg:items-end">
            <div>
              <p className="text-sm font-bold text-teal">A closer look</p>
              <h2 className="mt-4 text-4xl font-black tracking-[-.045em] text-wrap-balance sm:text-5xl">
                One workspace. Different kinds of clarity.
              </h2>
            </div>
            <p className="max-w-xl text-lg leading-8 text-slate-700">
              Scht gives every view a job: plan the day, understand a course, or
              decide what deserves a reminder. The details stay connected
              without competing for attention.
            </p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            <article className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-[#fbfcfc] shadow-sm">
              <div className="border-b border-slate-200 bg-[#f0f6f5] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal">
                    SUBJECT VIEW
                  </span>
                  <BookOpenText className="size-5 text-teal" />
                </div>
                <h3 className="mt-5 text-xl font-black">Applied Mathematics</h3>
                <p className="mt-1 text-sm text-slate-600">
                  2 tasks · syllabus reviewed
                </p>
              </div>
              <div className="space-y-3 p-5">
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <div className="flex justify-between text-sm">
                    <strong>Problem sets</strong>
                    <span className="font-bold text-teal">35%</span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-[#dceee9]">
                    <div className="h-1.5 w-[35%] rounded-full bg-teal" />
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="font-bold">Problem set 3</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Due tomorrow · 40 min
                  </p>
                </div>
                <p className="pt-1 text-sm font-semibold text-teal">
                  Open syllabus and weights →
                </p>
              </div>
            </article>
            <article className="overflow-hidden rounded-[1.75rem] bg-[#253a57] text-white shadow-sm">
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#c7e6dd]">
                    REMINDER PLAN
                  </span>
                  <BellRing className="size-5 text-[#f3b68b]" />
                </div>
                <h3 className="mt-5 text-xl font-black">Quiet by default.</h3>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Decide when Scht may interrupt you—then let it handle the
                  timing.
                </p>
              </div>
              <div className="mx-5 mb-5 rounded-2xl border border-white/15 bg-white/8 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-teal-100">
                    Tomorrow, 9:00 AM
                  </span>
                  <span className="rounded-lg bg-[#f3b68b] px-2 py-1 text-xs font-black text-[#51321e]">
                    ON
                  </span>
                </div>
                <p className="mt-4 font-bold">Problem set 3</p>
                <p className="mt-1 text-sm text-teal-100">
                  One hour before deadline
                </p>
              </div>
            </article>
            <article className="overflow-hidden rounded-[1.75rem] border border-[#c7e6dd] bg-[#eff8f6] shadow-sm">
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal">
                    AI PROPOSAL
                  </span>
                  <Sparkles className="size-5 text-teal" />
                </div>
                <h3 className="mt-5 text-xl font-black">
                  Advice, not autopilot.
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#285356]">
                  Turn a messy brief into reviewable tasks, then choose what is
                  worth keeping.
                </p>
              </div>
              <div className="mx-5 mb-5 rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <Check className="mt-0.5 size-5 text-teal" />
                  <div>
                    <p className="font-bold">Read chapter 5 notes</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Suggested · due Friday
                    </p>
                  </div>
                </div>
                <button
                  className="mt-4 w-full rounded-xl border border-teal px-3 py-2 text-sm font-bold text-teal"
                  type="button"
                >
                  Review before applying
                </button>
              </div>
            </article>
          </div>
        </div>
      </section>
      <section
        className="mx-auto max-w-5xl px-5 py-20 sm:px-8 sm:py-28 lg:px-10"
        id="questions"
      >
        <div className="text-center">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-teal">
            <CircleHelp className="size-4" />
            Questions, answered
          </span>
          <h2 className="mt-4 text-4xl font-black tracking-[-.045em] text-wrap-balance sm:text-5xl">
            Everything should be clear before you begin.
          </h2>
        </div>
        <div className="mt-10 divide-y divide-slate-200 rounded-[1.75rem] border border-slate-200 bg-white px-5 shadow-sm sm:px-8">
          {questions.map(([question, answer], index) => (
            <details className="group py-5" key={question} open={index === 0}>
              <summary className="cursor-pointer list-none pr-8 font-black marker:content-none">
                <span>{question}</span>
                <span
                  aria-hidden="true"
                  className="float-right text-xl text-teal transition group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="max-w-3xl pt-3 leading-7 text-slate-700">
                {answer}
              </p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
