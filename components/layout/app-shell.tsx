import type { ReactNode } from 'react';
import { BookOpen, BriefcaseBusiness, CalendarDays, ClipboardList, GraduationCap, LayoutDashboard, MoreHorizontal, Plus, Settings } from 'lucide-react';

const desktopLinks = [{ href: '/today', label: 'Today', icon: LayoutDashboard }, { href: '/planner', label: 'Planner', icon: ClipboardList }, { href: '/calendar', label: 'Calendar', icon: CalendarDays }, { href: '/subjects', label: 'Subjects', icon: BookOpen }, { href: '/grades', label: 'Grades', icon: GraduationCap }, { href: '/work', label: 'Work', icon: BriefcaseBusiness }, { href: '/settings', label: 'Settings', icon: Settings }];
const mobileLinks = [{ href: '/today', label: 'Today', icon: LayoutDashboard }, { href: '/planner', label: 'Planner', icon: ClipboardList }, { href: '/today#new-task-title', label: 'Add task', icon: Plus, primary: true }, { href: '/calendar', label: 'Calendar', icon: CalendarDays }, { href: '/settings', label: 'More', icon: MoreHorizontal }];

export function AppShell({ children, header }: { children: ReactNode; header: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="hidden min-h-screen bg-teal px-4 py-6 text-white lg:block">
        <a href="/today" className="mb-8 flex min-h-11 items-center px-3 text-2xl font-bold">Scht</a>
        <nav aria-label="Main navigation" className="space-y-2">
          {desktopLinks.map(({ href, label, icon: Icon }) => <a className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-base font-bold transition hover:bg-white/10" href={href} key={href}><Icon size={22} aria-hidden="true" />{label}</a>)}
        </nav>
      </aside>
      <div className="min-w-0 px-4 py-4 sm:px-6 lg:px-10">
        <header className="mx-auto mb-6 flex max-w-5xl items-end justify-between gap-4"><a href="/today" className="text-2xl font-bold text-teal lg:hidden">Scht</a>{header}</header>
        {children}
      </div>
      <nav aria-label="Mobile navigation" className="fixed inset-x-3 bottom-3 z-10 flex min-h-16 items-center justify-around rounded-2xl border bg-white/95 px-1 shadow-lg backdrop-blur lg:hidden">
        {mobileLinks.map(({ href, label, icon: Icon, primary }) => (
          <a href={href} className={`grid min-h-11 min-w-11 place-items-center rounded-xl px-1 text-center text-xs font-bold ${primary ? 'bg-action text-white' : 'text-ink'}`} key={label}>
            <Icon size={22} aria-hidden="true" /><span>{label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
