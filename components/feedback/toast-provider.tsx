"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";

export type ToastTone = "success" | "error" | "info";

type Toast = { id: number; message: string; tone: ToastTone };
type ToastContextValue = { toast: (message: string, tone?: ToastTone) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const toastStyles: Record<ToastTone, { icon: typeof CheckCircle2; className: string; label: string }> = {
  success: { icon: CheckCircle2, className: "border-teal/25 bg-[#073f42] text-white", label: "Success" },
  error: { icon: CircleAlert, className: "border-red-200 bg-[#fff7f5] text-[#812f13]", label: "Action needed" },
  info: { icon: Info, className: "border-[#cfdde8] bg-[#f5f8fc] text-[#234877]", label: "Update" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.floor(Math.random() * 1_000);
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => dismiss(id), tone === "error" ? 8_000 : 5_000);
  }, [dismiss]);
  const value = useMemo(() => ({ toast }), [toast]);

  return <ToastContext.Provider value={value}>
    {children}
    <div aria-atomic="false" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-[5.75rem] z-50 mx-auto flex w-auto max-w-md flex-col gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[min(26rem,calc(100vw-3rem))] lg:bottom-6">
      {toasts.map((toastItem) => {
        const style = toastStyles[toastItem.tone]; const Icon = style.icon;
        return <div className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-[0_16px_38px_rgba(20,37,51,.2)] ${style.className}`} key={toastItem.id} role={toastItem.tone === "error" ? "alert" : "status"}>
          <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1"><p className="text-sm font-black">{style.label}</p><p className="mt-0.5 break-words text-sm leading-5">{toastItem.message}</p></div>
          <button aria-label="Dismiss notification" className="grid min-h-9 min-w-9 shrink-0 place-items-center rounded-lg opacity-80 transition hover:bg-black/10 hover:opacity-100 focus-visible:outline-current" onClick={() => dismiss(toastItem.id)} type="button"><X aria-hidden="true" className="size-4" /></button>
        </div>;
      })}
    </div>
  </ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider.");
  return context;
}
