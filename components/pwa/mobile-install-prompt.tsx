'use client';

import { Download, Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type DeferredInstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>; };
type PromptKind = 'native' | 'ios' | 'menu' | null;

const DISMISS_KEY = 'scht-install-dismissed-at';
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;

export function mobileInstallPromptKind(userAgent: string, isStandalone: boolean): PromptKind {
  if (isStandalone || !/Android|iPhone|iPad|iPod/i.test(userAgent)) return null;
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  return /Android/i.test(userAgent) ? 'menu' : null;
}

export function MobileInstallPrompt() {
  const [kind, setKind] = useState<PromptKind>(() => {
    if (typeof window === 'undefined') return null;
    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (dismissedAt > Date.now() - DISMISS_FOR_MS || standalone) return null;
    return mobileInstallPromptKind(navigator.userAgent, standalone);
  });
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredInstallPrompt | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone) return;
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredInstallPrompt);
      setKind('native');
    };
    window.addEventListener('beforeinstallprompt', captureInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', captureInstallPrompt);
  }, []);

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setKind(null);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') setKind(null);
    else dismiss();
  }

  if (!kind) return null;
  const ios = kind === 'ios';
  return <aside aria-label="Install Scht" className="fixed inset-x-3 bottom-24 z-20 mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-teal/20 bg-white p-4 shadow-lg sm:bottom-5"><div className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-teal text-white">{ios ? <Share size={20} aria-hidden="true" /> : <Download size={20} aria-hidden="true" />}</div><div className="min-w-0 flex-1"><p className="font-bold">Install Scht</p><p className="mt-1 text-sm text-slate-600">{kind === 'native' ? 'Add Scht to your home screen for a faster, app-like planner.' : ios ? 'Tap Share, then choose Add to Home Screen.' : 'Use your browser menu and choose Install app or Add to Home screen.'}</p>{kind === 'native' && <button type="button" className="mt-3 rounded-lg bg-action px-3 py-2 text-sm font-bold text-white" onClick={install}>Install app</button>}</div><button type="button" aria-label="Dismiss install prompt" className="grid min-h-11 min-w-11 place-items-center rounded-xl text-slate-600 hover:bg-slate-100" onClick={dismiss}><X size={20} aria-hidden="true" /></button></aside>;
}
