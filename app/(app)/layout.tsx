import { AppShell } from "@/components/layout/app-shell";
import { CurrentTermControl } from "@/components/layout/current-term-control";
import { OwnerAdminLink } from "@/components/layout/owner-admin-link";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { AcademicTermName } from "@/lib/curriculum/types";

const termNames: Record<AcademicTermName, string> = {
  Intersession: "Intersession",
  "First Semester": "First Semester",
  "Second Semester": "Second Semester",
};

export default async function AuthenticatedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: profile }, { data: terms }, { data: connections }] = await Promise.all([
    supabase
      .from("profiles")
      .select("current_term_id")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("academic_terms")
      .select("id, academic_year, name")
      .eq("user_id", user.id)
      .order("academic_year", { ascending: false }),
    supabase
      .from("integration_connections")
      .select("status")
      .eq("user_id", user.id)
      .in("provider", ["google", "canvas"]),
  ]);
  const options = (terms ?? []).map((term) => ({
    id: term.id,
    label: `${term.academic_year}–${term.academic_year + 1} · ${termNames[term.name as AcademicTermName]}`,
  }));

  const termControl =
    profile?.current_term_id && options.length > 0 ? (
      <CurrentTermControl
        currentTermId={profile.current_term_id}
        terms={options}
      />
    ) : (
      <span />
    );
  const header = (
    <div className="flex items-center justify-between gap-3 sm:justify-end">
      {user.role === "owner_admin" ? <OwnerAdminLink /> : null}
      <div className="min-w-0">{termControl}</div>
    </div>
  );

  const hasIntegrationAttention = (connections ?? []).some(
    (connection) => connection.status === "error",
  );

  return <AppShell header={header} hasIntegrationAttention={hasIntegrationAttention}>{children}</AppShell>;
}
