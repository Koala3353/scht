import { BellRing, Cable, KeyRound, SlidersHorizontal } from "lucide-react";

const items = [
  { href: "#connections", label: "Connections", icon: Cable },
  { href: "#ai-vault", label: "AI vault", icon: KeyRound },
  { href: "#academic-scale", label: "Academic scale", icon: SlidersHorizontal },
  { href: "#reminders", label: "Reminders", icon: BellRing },
];

export function SettingsNavigation() {
  return (
    <nav
      aria-label="Settings sections"
      className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map(({ href, label, icon: Icon }) => (
        <a
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-teal/40 hover:bg-[#e6f2f0] hover:text-teal focus-visible:outline-teal"
          href={href}
          key={href}
        >
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </a>
      ))}
    </nav>
  );
}
