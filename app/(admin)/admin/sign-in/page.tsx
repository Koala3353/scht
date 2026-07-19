import { AdminSignIn } from "@/components/auth/admin-sign-in";
import { googleAudienceUrl } from "@/lib/admin/google-auth";

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AdminSignIn
      error={error}
      googleAudienceUrl={googleAudienceUrl(process.env.GOOGLE_CLOUD_PROJECT_ID)}
    />
  );
}
