import { redirect } from "next/navigation";
import { IpsImport } from "@/components/onboarding/ips-import";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { SetupWizard } from "@/components/onboarding/setup-wizard";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { AcademicTermName } from "@/lib/curriculum/types";

function academicYearForToday() {
  return new Date().getUTCFullYear();
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("current_term_id, onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.onboarding_completed_at) redirect("/today");
  const [{ data: currentTerm }, { data: connections }] =
    profile?.current_term_id
      ? await Promise.all([
          supabase
            .from("academic_terms")
            .select("id, academic_year, name")
            .eq("id", profile.current_term_id)
            .maybeSingle(),
          supabase
            .from("integration_connections")
            .select("provider, status")
            .eq("user_id", user.id)
            .in("provider", ["google", "canvas"]),
        ])
      : [{ data: null }, { data: [] }];
  const label = currentTerm
    ? `${currentTerm.academic_year}–${currentTerm.academic_year + 1} · ${currentTerm.name as AcademicTermName}`
    : "";

  if (!currentTerm)
    return (
      <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-bold tracking-[.16em] text-teal">
          SET UP YOUR WORKSPACE
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          Choose your current academic term
        </h1>
        <p className="mt-3 text-slate-600">
          Today will show work for this term. You can add or select historical
          terms later.
        </p>
        <OnboardingForm defaultYear={academicYearForToday()} userId={user.id} />
      </section>
    );

  return (
    <section className="mx-auto max-w-3xl pb-8">
      {params.step === "curriculum" ? (
        <IpsImport
          academicYear={currentTerm.academic_year}
          termId={currentTerm.id}
          termLabel={label}
          termName={currentTerm.name as AcademicTermName}
        />
      ) : null}
      <SetupWizard
        connections={(connections ?? []).filter(
          (
            connection,
          ): connection is { provider: "google" | "canvas"; status: string } =>
            connection.provider === "google" ||
            connection.provider === "canvas",
        )}
        termLabel={label}
        userId={user.id}
      />
    </section>
  );
}
