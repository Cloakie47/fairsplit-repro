"use client";

import { useEffect, useState } from "react";
import { subscribeToasts, type ToastPayload } from "@/lib/toast";

type ToastItem = ToastPayload & { createdAt: number };

const TOAST_LIFETIME_MS = 3200;

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToasts((payload) => {
      const next: ToastItem = { ...payload, createdAt: Date.now() };
      setToasts((prev) => [...prev, next]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== payload.id));
      }, TOAST_LIFETIME_MS);
    });
    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[230] flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto border-2 border-brand-black p-3 shadow-brutal ${
            toast.kind === "error"
              ? "border-brand-red bg-white"
              : "bg-brand-cream"
          }`}
        >
          <div className="flex items-start gap-2">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border-2 font-mono text-xs font-bold text-white ${
                toast.kind === "error"
                  ? "border-brand-black bg-brand-red"
                  : "border-brand-black bg-brand-green"
              }`}
            >
              {toast.kind === "error" ? "✕" : "✓"}
            </span>
            <div className="min-w-0">
              <p
                className={`truncate font-grotesk text-sm font-bold ${
                  toast.kind === "error" ? "text-brand-red" : "text-brand-black"
                }`}
              >
                {toast.title}
              </p>
              {toast.description && (
                <p className="mt-0.5 font-mono text-xs text-brand-muted">
                  {toast.description}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
