import { notFound } from 'next/navigation';
import { DemoWorkspace } from '@/components/demo/demo-workspace';

export const dynamic = 'force-dynamic';

export default function DemoPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <DemoWorkspace />;
}
