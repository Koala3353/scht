'use client';

export interface TermOption { id: string; label: string; }
interface TermSwitcherProps { terms: TermOption[]; value: string; onChange: (termId: string) => void; }

export function TermSwitcher({ terms, value, onChange }: TermSwitcherProps) {
  return <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
    <span>Current academic term</span>
    <select aria-label="Current academic term" className="min-h-[var(--touch-target)] rounded-lg border border-slate-300 bg-white px-3 font-medium" onChange={(event) => onChange(event.target.value)} value={value}>
      {terms.map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}
    </select>
  </label>;
}
