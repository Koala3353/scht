import type { ReactNode } from 'react';

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <header className="max-w-3xl pt-1"><p className="text-xs font-extrabold tracking-[.14em] text-teal">{eyebrow}</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>{children && <div className="mt-2 max-w-2xl text-slate-600">{children}</div>}</header>;
}
