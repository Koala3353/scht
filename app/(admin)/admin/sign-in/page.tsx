import { AdminSignIn } from "@/components/auth/admin-sign-in";
import { googleAudienceUrl } from "@/lib/admin/google-auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AdminSignIn
      canSignOut={Boolean(user)}
      error={error}
      googleAudienceUrl={googleAudienceUrl(process.env.GOOGLE_CLOUD_PROJECT_ID)}
    />
  );
}
