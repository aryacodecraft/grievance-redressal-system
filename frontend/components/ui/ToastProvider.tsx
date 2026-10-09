"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; title: string; message?: string; tone: ToastTone };
type ToastContextValue = { notify: (title: string, message?: string, tone?: ToastTone) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const notify = useCallback((title: string, message?: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, title, message, tone }].slice(-4));
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4500);
  }, []);
  const value = useMemo(() => ({ notify }), [notify]);
  const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
  return <ToastContext.Provider value={value}>{children}<div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">{items.map((item) => { const Icon = icons[item.tone]; return <div key={item.id} role={item.tone === "error" ? "alert" : "status"} className="pointer-events-auto flex items-start gap-3 rounded-lg border border-ink-200 bg-white p-4 shadow-lg"><Icon size={18} className={item.tone === "error" ? "text-rose-600" : item.tone === "info" ? "text-primary-700" : "text-emerald-600"} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink-900">{item.title}</p>{item.message && <p className="mt-0.5 text-xs text-ink-600">{item.message}</p>}</div><button type="button" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} aria-label="Dismiss notification" className="text-ink-400 hover:text-ink-800"><X size={15} /></button></div>; })}</div></ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
