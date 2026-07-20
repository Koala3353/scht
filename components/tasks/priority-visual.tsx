import { ArrowDown, Circle, Flame } from "lucide-react";

import type { CachedTask } from "@/lib/sync/types";

type Priority = CachedTask["priority"];

const priorityMeta: Record<Priority, { label: string; badgeClass: string; cardClass: string; selectClass: string; Icon: typeof Flame }> = {
  high: {
    label: "High",
    badgeClass: "border-[#f4c3a4] bg-[#fff0e8] text-[#9f3f08]",
    cardClass: "bg-[#fffdfb] ring-1 ring-inset ring-[#edb18b]",
    selectClass: "border-[#e7a174] bg-[#fff7f2] text-[#9f3f08]",
    Icon: Flame,
  },
  normal: {
    label: "Normal",
    badgeClass: "border-[#b9ddd6] bg-[#e6f2f0] text-teal",
    cardClass: "bg-[#fbfefd] ring-1 ring-inset ring-[#b9ddd6]",
    selectClass: "border-[#9ccbc2] bg-[#f5fbfa] text-teal",
    Icon: Circle,
  },
  low: {
    label: "Low",
    badgeClass: "border-slate-200 bg-slate-100 text-slate-600",
    cardClass: "bg-slate-50/70 ring-1 ring-inset ring-slate-200",
    selectClass: "border-slate-300 bg-slate-50 text-slate-700",
    Icon: ArrowDown,
  },
};

export function PriorityBadge({ priority, compact = false }: { priority: Priority; compact?: boolean }) {
  const { Icon, badgeClass, label } = priorityMeta[priority];
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-extrabold ${badgeClass}`}><Icon aria-hidden="true" className="size-3.5" />{compact ? label : `${label} priority`}</span>;
}

export function priorityCardClass(priority: Priority, completed = false) {
  return completed ? "bg-slate-50 ring-1 ring-inset ring-slate-200" : priorityMeta[priority].cardClass;
}

export function prioritySelectClass(priority: Priority) {
  return priorityMeta[priority].selectClass;
}
