"use client";

import { useState } from "react";

export function SubjectUnitsEditor({
  subjectId,
  initialUnits,
}: {
  subjectId: string;
  initialUnits: number;
}) {
  const [units, setUnits] = useState(String(initialUnits));
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const response = await fetch("/api/subjects/units", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subjectId, units: Number(units) }),
    });
    const body = (await response.json()) as { error?: string };
    setNotice(
      response.ok ? "Units saved." : (body.error ?? "Could not save units."),
    );
    setBusy(false);
  }
  return (
    <div className="mt-4 flex flex-wrap items-end gap-2">
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Course units
        <input
          aria-label="Course units"
          className="mt-1 block w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm font-semibold text-ink normal-case tracking-normal"
          min="0.5"
          onChange={(event) => setUnits(event.target.value)}
          step="0.5"
          type="number"
          value={units}
        />
      </label>
      <button
        className="rounded-lg border border-teal px-3 py-1 text-sm font-bold text-teal disabled:opacity-60"
        disabled={busy}
        onClick={() => void save()}
        type="button"
      >
        Save units
      </button>
      {notice && (
        <span className="text-xs text-slate-600" role="status">
          {notice}
        </span>
      )}
    </div>
  );
}
