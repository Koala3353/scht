"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";

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
    <section aria-labelledby="academic-scale-heading" id="academic-scale">
      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-teal">Academic scale</p>
            <h2
              className="mt-1 text-2xl font-black tracking-tight"
              id="academic-scale-heading"
            >
              Keep your standing in the language your school uses.
            </h2>
            <p className="mt-3 leading-7 text-slate-700">
              Ateneo QPI and GPA use the same course-unit weighting. The scale
              only changes how your subject percentages are expressed.
            </p>
          </div>
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e6f2f0] text-teal">
            <GraduationCap className="size-5" aria-hidden="true" />
          </span>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <button
            aria-pressed={scale === "qpi"}
            className={`rounded-2xl border p-5 text-left transition focus-visible:outline-teal ${
              scale === "qpi"
                ? "border-teal bg-[#e6f2f0] shadow-sm"
                : "border-slate-200 bg-white hover:border-teal/45 hover:bg-[#f7fbfa]"
            }`}
            disabled={busy}
            onClick={() => void save("qpi")}
            type="button"
          >
            <strong className="block text-lg">Ateneo QPI</strong>
            <span className="mt-2 block text-sm leading-6 text-slate-700">
              A=4.0, B+=3.5, B=3.0, C+=2.5, C=2.0, D=1.0, F=0.0.
            </span>
          </button>
          <button
            aria-pressed={scale === "gpa"}
            className={`rounded-2xl border p-5 text-left transition focus-visible:outline-teal ${
              scale === "gpa"
                ? "border-teal bg-[#e6f2f0] shadow-sm"
                : "border-slate-200 bg-white hover:border-teal/45 hover:bg-[#f7fbfa]"
            }`}
            disabled={busy}
            onClick={() => void save("gpa")}
            type="button"
          >
            <strong className="block text-lg">4.0 GPA</strong>
            <span className="mt-2 block text-sm leading-6 text-slate-700">
              A unit-weighted estimate based on each subject’s current
              percentage.
            </span>
          </button>
        </div>
      </div>
      {notice && (
        <p
          className="mt-4 rounded-xl bg-[#e6f2f0] px-4 py-3 text-sm font-semibold text-teal"
          role="status"
        >
          {notice}
        </p>
      )}
    </section>
  );
}
