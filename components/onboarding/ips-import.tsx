interface IpsImportProps { termLabel: string; }

// Task 4 replaces this hand-off with the parser, preview, and import transaction.
export function IpsImport({ termLabel }: IpsImportProps) {
  return <section aria-labelledby="curriculum-import-heading" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <p className="text-sm font-bold tracking-[.12em] text-teal">NEXT STEP</p>
    <h2 className="mt-2 text-2xl font-bold" id="curriculum-import-heading">Import your curriculum</h2>
    <p className="mt-3 text-slate-600">Your selected term is <strong>{termLabel}</strong>. Paste your IPS in the next step to preview its courses.</p>
  </section>;
}
