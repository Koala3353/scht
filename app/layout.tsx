import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register';
import { MobileInstallPrompt } from '@/components/pwa/mobile-install-prompt';
import { ChunkRecovery } from '@/components/pwa/chunk-recovery';
import { ToastProvider } from '../components/feedback/toast-provider';
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Scht', template: '%s · Scht' },
  description: 'Scht is a private academic planner that helps students organize courses, deadlines, grades, and optional connected services.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = { themeColor: '#075e60' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><ToastProvider>{children}</ToastProvider><ChunkRecovery /><ServiceWorkerRegister /><MobileInstallPrompt /></body></html>;
}
