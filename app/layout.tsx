import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register';
import { MobileInstallPrompt } from '@/components/pwa/mobile-install-prompt';
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Scht', template: '%s · Scht' },
  description: 'Your school and work flow, in one place.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = { themeColor: '#075e60' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<ServiceWorkerRegister /><MobileInstallPrompt /></body></html>;
}
