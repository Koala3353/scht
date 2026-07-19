import {
  BookOpen,
  CalendarDays,
  Cloud,
  GraduationCap,
  HelpCircle,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/workspace/page-header";

const sections = [
  {
    icon: BookOpen,
    title: "Start with your term",
    body: "Choose the term you are actively living in. Today, planner work, subjects, and grade context are kept focused on it.",
    href: "/onboarding",
    action: "Review setup",
  },
  {
    icon: CalendarDays,
    title: "Connect Google when it helps",
    body: "Calendar events and unread Gmail subjects can be reviewed and synced into your workspace. Scht only imports what you choose.",
    href: "/settings#connections",
    action: "Open connections",
  },
  {
    icon: Cloud,
    title: "Bring in Canvas assignments",
    body: "Use your institution’s Canvas URL and a personal access token. Credentials are encrypted before they are saved.",
    href: "/settings#connections",
    action: "Set up Canvas",
  },
  {
    icon: GraduationCap,
    title: "Make grades meaningful",
    body: "Set course units, review syllabus weights, then record assessments. Scht defaults to Ateneo QPI and can switch to GPA.",
    href: "/subjects",
    action: "Open subjects",
  },
  {
    icon: KeyRound,
    title: "Use AI with a boundary",
    body: "Save your own OpenAI or Hack Club key in the encrypted vault. AI proposes tasks; it never adds them without your review.",
    href: "/settings#ai-vault",
    action: "Open AI vault",
  },
  {
    icon: ShieldCheck,
    title: "Keep control of your data",
    body: "Connections are optional, reminders respect quiet hours, and owner exports are audited. You can revisit settings whenever your routine changes.",
    href: "/settings",
    action: "Open settings",
  },
];

export default function HelpPage() {
  return (
    <main className="pb-8">
      <div className="max-w-3xl">
        <PageHeader eyebrow="Help guide" title="A calmer way to get oriented.">
          A short guide to the parts of Scht that are most useful first. Nothing
          here is required; build the workspace around your actual routine.
        </PageHeader>
      </div>
      <section
        aria-label="Scht help topics"
        className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {sections.map(({ icon: Icon, title, body, href, action }) => (
          <article
            className="flex flex-col rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
            key={title}
          >
            <span className="grid size-11 place-items-center rounded-xl bg-[#e6f2f0] text-teal">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <h2 className="mt-5 text-xl font-black tracking-tight text-slate-950">
              {title}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-slate-700">
              {body}
            </p>
            <a
              className="mt-5 inline-flex min-h-11 items-center text-sm font-bold text-teal underline decoration-teal/30 underline-offset-4 hover:decoration-teal"
              href={href}
            >
              {action}
            </a>
          </article>
        ))}
      </section>
      <section className="mt-6 rounded-[1.5rem] border border-teal/15 bg-teal/5 p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
          <div className="flex items-center gap-2 font-bold text-slate-950">
            <HelpCircle aria-hidden="true" className="size-5 text-teal" />
            Not sure where to begin?
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            Start with your term, then add one connection or subject at a time.
            The Today view will grow with you.
          </p>
        </div>
        <a
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-teal px-4 text-sm font-bold text-white sm:mt-0"
          href="/today"
        >
          Open Today
        </a>
      </section>
    </main>
  );
}
