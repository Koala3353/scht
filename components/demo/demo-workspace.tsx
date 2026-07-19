/* eslint-disable @next/next/no-html-link-for-pages */
"use client";

import {
  CalendarDays,
  Check,
  ChevronLeft,
  Clock3,
  GraduationCap,
  Mail,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

const startingTasks = [
  {
    id: "math",
    title: "Problem set 3",
    course: "Applied Mathematics",
    due: "Tomorrow · 10:00 AM",
    done: false,
  },
  {
    id: "writing",
    title: "Draft thesis outline",
    course: "Academic Writing",
    due: "Fri · 5:00 PM",
    done: false,
  },
  {
    id: "reading",
    title: "Review research reading",
    course: "Methods seminar",
    due: "Fri · 7:00 PM",
    done: false,
  },
];

export function DemoWorkspace() {
  const [tasks, setTasks] = useState(startingTasks);
  const completed = tasks.filter((task) => task.done).length;
  return (
    <main className="min-h-screen bg-[#f4f7f7] text-ink">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <p className="text-sm font-black tracking-[-.05em] text-teal">
              Scht<span className="text-action">.</span>
            </p>
            <p className="text-xs font-bold text-slate-500">
              INTERACTIVE LOCAL DEMO
            </p>
          </div>
          <a
            className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-2 text-sm font-bold hover:border-teal hover:text-teal"
            href="/"
          >
            <ChevronLeft className="size-4" />
            Landing page
          </a>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-bold text-teal">TUESDAY · 14 OCT</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-.05em]">
              A good day to begin.
            </h1>
            <p className="mt-3 max-w-2xl text-slate-700">
              This local preview lets you complete tasks and explore the shape
              of the Scht workspace without connecting an account.
            </p>
          </div>
          <div className="rounded-2xl bg-[#083f42] px-4 py-3 text-white">
            <p className="text-xs font-bold text-[#c7e6dd]">TODAY’S PROGRESS</p>
            <p className="mt-1 text-2xl font-black">
              {completed}
              <span className="text-base text-teal-100">
                {" "}
                / {tasks.length} complete
              </span>
            </p>
          </div>
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black">Your focus list</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Tap a task when it is done.
                </p>
              </div>
              <Clock3 className="size-6 text-teal" />
            </div>
            <div className="mt-6 space-y-3">
              {tasks.map((task) => (
                <button
                  aria-pressed={task.done}
                  className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${task.done ? "border-[#c7e6dd] bg-[#eff8f6]" : "border-slate-200 hover:border-teal/50 hover:bg-[#f8fbfb]"}`}
                  key={task.id}
                  onClick={() =>
                    setTasks((current) =>
                      current.map((item) =>
                        item.id === task.id
                          ? { ...item, done: !item.done }
                          : item,
                      ),
                    )
                  }
                  type="button"
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full border-2 ${task.done ? "border-teal bg-teal text-white" : "border-slate-300 bg-white text-transparent"}`}
                  >
                    <Check className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block font-bold ${task.done ? "text-slate-500 line-through" : ""}`}
                    >
                      {task.title}
                    </span>
                    <span className="mt-1 block text-sm text-slate-600">
                      {task.course} · {task.due}
                    </span>
                  </span>
                  <span className="hidden rounded-lg bg-[#f7ebe3] px-2 py-1 text-xs font-bold text-action sm:block">
                    SCHOOL
                  </span>
                </button>
              ))}
            </div>
          </section>
          <aside className="space-y-5">
            <section className="rounded-[1.75rem] bg-[#083f42] p-6 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-[#c7e6dd]">
                    ACADEMIC STANDING
                  </p>
                  <p className="mt-3 text-5xl font-black tracking-[-.07em]">
                    91<span className="text-2xl text-[#c7e6dd]">%</span>
                  </p>
                  <p className="mt-1 text-sm text-teal-100">Current average</p>
                </div>
                <GraduationCap className="size-7 text-[#f3b68b]" />
              </div>
              <div className="mt-6 border-t border-white/15 pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-teal-100">Graded weight</span>
                  <strong>68%</strong>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/15">
                  <div className="h-2 w-[68%] rounded-full bg-[#f3b68b]" />
                </div>
              </div>
            </section>
            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-[#e8eef9] text-[#345d9d]">
                  <CalendarDays className="size-5" />
                </span>
                <div>
                  <h2 className="font-black">Next on your calendar</h2>
                  <p className="text-sm text-slate-600">
                    1:30 PM · Methods seminar
                  </p>
                </div>
              </div>
              <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
                <span className="grid size-9 place-items-center rounded-xl bg-[#f7ebe3] text-action">
                  <Mail className="size-5" />
                </span>
                <p className="text-sm text-slate-700">
                  <strong>Gmail ready</strong>
                  <br />
                  Unread messages can become review tasks.
                </p>
              </div>
            </section>
            <section className="rounded-[1.75rem] border border-[#c7e6dd] bg-[#eff8f6] p-6">
              <div className="flex items-center gap-3">
                <Sparkles className="size-6 text-teal" />
                <h2 className="font-black">Reviewed AI planning</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#285356]">
                Ask for a plan, review every suggested task, then apply only the
                items you want.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
