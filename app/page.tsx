import { LandingPage } from '@/components/marketing/landing-page';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams;
  return <LandingPage authenticationError={error} />;
}
