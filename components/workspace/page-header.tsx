import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="max-w-3xl">
      <p className="text-sm font-semibold text-teal">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-wrap-balance sm:text-4xl">
        {title}
      </h1>
      {children && (
        <div className="mt-3 max-w-2xl text-[0.98rem] leading-7 text-slate-700">
          {children}
        </div>
      )}
    </header>
  );
}
