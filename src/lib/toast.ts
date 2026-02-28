"use client";

export type ToastKind = "success";

export type ToastPayload = {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
};

const TOAST_EVENT = "fairysplit_toast_event";

function emitToast(payload: ToastPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail: payload }));
}

export function subscribeToasts(listener: (payload: ToastPayload) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const custom = event as CustomEvent<ToastPayload>;
    if (!custom.detail) return;
    listener(custom.detail);
  };
  window.addEventListener(TOAST_EVENT, handler);
  return () => window.removeEventListener(TOAST_EVENT, handler);
}

export function showSuccessToast(title: string, description?: string) {
  emitToast({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: "success",
    title,
    description,
  });
}
