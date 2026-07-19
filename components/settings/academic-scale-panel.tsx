"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AcademicScalePanel({
  academicScale,
}: {
  academicScale: "qpi" | "gpa";
}) {
  const router = useRouter();
  const [scale, setScale] = useState(academicScale);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(nextScale: "qpi" | "gpa") {
    setScale(nextScale);
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/settings/academic-scale", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ academicScale: nextScale }),
    });
    const body = (await response.json()) as { error?: string };
    if (response.ok) router.refresh();
    setNotice(
      response.ok
        ? `${nextScale === "qpi" ? "Ateneo QPI" : "4.0 GPA"} selected. Your grade summary is updated.`
        : (body.error ?? "Could not update your academic scale."),
    );
    if (!response.ok) setScale(academicScale);
    setBusy(false);
  }
  return (
    <section className="mt-5 max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold">Academic scale</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
        Ateneo QPI uses course units and the Ateneo point scale. GPA keeps the
        same unit-weighted course model while displaying a transparent 4.0 GPA
        estimate.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          aria-pressed={scale === "qpi"}
          className={`rounded-xl border p-4 text-left transition ${scale === "qpi" ? "border-teal bg-[#eff8f6]" : "border-slate-200 hover:border-teal/50"}`}
          disabled={busy}
          onClick={() => void save("qpi")}
          type="button"
        >
          <strong className="block">Ateneo QPI</strong>
          <span className="mt-1 block text-sm text-slate-600">
            A=4.0, B+=3.5, B=3.0, C+=2.5, C=2.0, D=1.0, F=0.0.
          </span>
        </button>
        <button
          aria-pressed={scale === "gpa"}
          className={`rounded-xl border p-4 text-left transition ${scale === "gpa" ? "border-teal bg-[#eff8f6]" : "border-slate-200 hover:border-teal/50"}`}
          disabled={busy}
          onClick={() => void save("gpa")}
          type="button"
        >
          <strong className="block">4.0 GPA</strong>
          <span className="mt-1 block text-sm text-slate-600">
            A unit-weighted estimate based on each subject’s current percentage.
          </span>
        </button>
      </div>
      {notice && (
        <p className="mt-3 text-sm text-slate-700" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
