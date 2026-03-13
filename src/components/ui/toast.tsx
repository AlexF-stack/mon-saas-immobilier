"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error" | "warning";

export type ToastOptions = {
  id?: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastInternal = ToastOptions & { id: string };

type ToastContextValue = {
  show: (options: ToastOptions) => void;
};

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within <ToastProvider>");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastInternal[]>([]);

  const remove = React.useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = React.useCallback(
    (options: ToastOptions) => {
      const id = options.id ?? crypto.randomUUID();
      const toast: ToastInternal = {
        id,
        title: options.title,
        description: options.description,
        variant: options.variant ?? "default",
        durationMs: options.durationMs ?? 3800,
      };
      setToasts((current) => [...current, toast]);

      if (toast.durationMs && toast.durationMs > 0) {
        window.setTimeout(() => remove(id), toast.durationMs);
      }
    },
    [remove]
  );

  const value = React.useMemo<ToastContextValue>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-3 sm:top-4 sm:justify-end sm:px-6">
        <div className="flex w-full max-w-sm flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="status"
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-card backdrop-blur-md transition-transform animate-fade-in",
                toast.variant === "success" &&
                  "border-emerald-200 bg-emerald-50/90 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-50",
                toast.variant === "error" &&
                  "border-rose-200 bg-rose-50/90 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-50",
                toast.variant === "warning" &&
                  "border-amber-200 bg-amber-50/90 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-50",
                toast.variant === "default" &&
                  "border-border bg-card/95 text-primary dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-50"
              )}
            >
              <div className="flex-1 space-y-1">
                {toast.title && (
                  <p className="text-sm font-semibold leading-tight">{toast.title}</p>
                )}
                {toast.description && (
                  <p className="text-xs text-secondary dark:text-slate-300">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(toast.id)}
                className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-secondary hover:bg-surface hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Fermer la notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

