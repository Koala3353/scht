import type { ReactNode } from 'react';

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <header className="mx-auto max-w-5xl px-4 pt-2 sm:px-0"><p className="text-xs font-extrabold tracking-[.14em] text-teal">{eyebrow}</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>{children && <div className="mt-2 text-slate-600">{children}</div>}</header>;
}
