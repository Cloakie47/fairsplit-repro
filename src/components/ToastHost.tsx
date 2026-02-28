"use client";

import { useEffect, useState } from "react";
import { subscribeToasts, type ToastPayload } from "@/lib/toast";

type ToastItem = ToastPayload & { createdAt: number };

const TOAST_LIFETIME_MS = 3200;

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToasts((payload) => {
      const next: ToastItem = {
        ...payload,
        createdAt: Date.now(),
      };
      setToasts((prev) => [...prev, next]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== payload.id));
      }, TOAST_LIFETIME_MS);
    });
    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[230] flex w-[min(90vw,22rem)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="rounded-xl border border-emerald-200 bg-white/95 px-3.5 py-3 text-stone-900"
        >
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
              ✓
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 text-xs text-stone-600">{toast.description}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
