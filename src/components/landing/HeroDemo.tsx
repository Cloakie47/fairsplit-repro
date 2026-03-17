"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ToastItem = {
  icon: string;
  type: "success" | "warning" | "error" | "info";
  title: string;
  sub: string;
  person: "bob" | "alice" | "carol" | null;
  status: "paid" | "owed" | "conf" | null;
};

const TOASTS: ToastItem[] = [
  {
    icon: "✓",
    type: "success",
    title: "Payment successful",
    sub: "Direct pathUSD transfer confirmed",
    person: "bob",
    status: "paid",
  },
  {
    icon: "✓",
    type: "success",
    title: "Split created",
    sub: "Dinner at Fairsplit · 3 participants added",
    person: null,
    status: null,
  },
  {
    icon: "!",
    type: "warning",
    title: "Reminder sent",
    sub: "Bob notified — $80 still pending",
    person: "bob",
    status: "owed",
  },
  {
    icon: "✓",
    type: "success",
    title: "Payment successful",
    sub: "Confidential transfer · amount hidden",
    person: "carol",
    status: "conf",
  },
  {
    icon: "↑",
    type: "info",
    title: "Transaction submitted",
    sub: "Waiting for on-chain confirmation...",
    person: null,
    status: null,
  },
  {
    icon: "✓",
    type: "success",
    title: "Split settled",
    sub: "All participants have paid ✦",
    person: "alice",
    status: "paid",
  },
];

const TOAST_ICON_CLASSES: Record<ToastItem["type"], string> = {
  success: "border-2 border-brand-black bg-brand-green text-white",
  warning: "border-2 border-brand-black bg-brand-yellow text-brand-black",
  error: "border-2 border-brand-black bg-brand-red text-white",
  info: "border-2 border-brand-black bg-brand-black text-brand-yellow",
};

export function HeroDemo() {
  const [displayIdx, setDisplayIdx] = useState(0);
  const [toastState, setToastState] = useState<"idle" | "enter" | "exit">("idle");
  const [bobState, setBobState] = useState<"paid" | "owed">("owed");
  const idxRef = useRef(0);

  const showToast = useCallback((t: ToastItem) => {
    setToastState("enter");
    if (t.person === "bob") {
      setBobState(t.status === "paid" ? "paid" : "owed");
    }
    setTimeout(() => {
      setToastState("exit");
      setTimeout(() => setToastState("idle"), 300);
    }, 3500);
  }, []);

  const cycle = useCallback(() => {
    setDisplayIdx(idxRef.current);
    showToast(TOASTS[idxRef.current]);
    idxRef.current = (idxRef.current + 1) % TOASTS.length;
  }, [showToast]);

  useEffect(() => {
    const first = setTimeout(cycle, 1400);
    return () => clearTimeout(first);
  }, [cycle]);

  useEffect(() => {
    const interval = setInterval(cycle, 4200);
    return () => clearInterval(interval);
  }, [cycle]);

  const current = TOASTS[displayIdx];
  const isEnter = toastState === "enter";
  const isExit = toastState === "exit";

  return (
    <div className="relative z-10 w-full max-w-[380px]">
      <div
        className="mb-4 border-2 border-brand-black bg-brand-yellow p-5 shadow-brutal-xl"
        style={{ animationDelay: "0.6s" }}
      >
        <div className="mb-1 font-mono text-[9px] font-bold uppercase tracking-widest text-brand-black/50">
          // Active split
        </div>
        <div className="mb-0.5 text-base font-bold uppercase tracking-tight text-brand-black">
          Dinner at Fairsplit
        </div>
        <div className="mb-3.5 text-[38px] font-bold leading-none tracking-tight text-brand-black">
          $240
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 border-2 border-brand-black bg-brand-black shadow-brutal-lg">
        <div className="border-r-2 border-brand-black bg-[#D0F5E3] p-3">
          <div className="mb-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-brand-muted">
            Alice
          </div>
          <div className="mb-1 text-[17px] font-bold tracking-tight text-brand-black">
            $80
          </div>
          <span className="inline-block border-[1.5px] border-brand-black bg-[#D0F5E3] px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-wider text-[#0A7A3C]">
            Paid ✓
          </span>
        </div>
        <div
          className={`border-r-2 border-brand-black p-3 transition-colors ${
            bobState === "paid" ? "bg-[#D0F5E3]" : "bg-white"
          }`}
        >
          <div className="mb-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-brand-muted">
            Bob
          </div>
          <div className="mb-1 text-[17px] font-bold tracking-tight text-brand-black">
            $80
          </div>
          <span
            className={`inline-block border-[1.5px] border-brand-black px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-wider ${
              bobState === "paid"
                ? "bg-[#D0F5E3] text-[#0A7A3C]"
                : "bg-[#FFD6D6] text-brand-red"
            }`}
          >
            {bobState === "paid" ? "Paid ✓" : "Pending"}
          </span>
        </div>
        <div className="p-3">
          <div className="mb-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-brand-muted">
            Carol
          </div>
          <div className="mb-1 text-[17px] font-bold tracking-tight text-brand-black">
            $80
          </div>
          <span className="inline-block border-[1.5px] border-brand-black bg-brand-black px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-wider text-brand-yellow">
            🔒 Priv
          </span>
        </div>
      </div>

      <div className="relative h-20">
        <div
          className={`absolute left-0 right-0 top-0 flex items-start gap-3 border-2 border-brand-black bg-brand-cream p-3 shadow-brutal-lg ${
            isEnter ? "animate-toast-in" : ""
          } ${isExit ? "animate-toast-out" : ""}`}
          style={{
            opacity: toastState === "idle" ? 0 : 1,
            pointerEvents: toastState === "idle" ? "none" : "auto",
            transform: toastState === "idle" ? "translateY(20px)" : undefined,
          }}
        >
          <div
            className={`flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center border-2 border-brand-black text-[11px] font-bold ${
              TOAST_ICON_CLASSES[current.type]
            }`}
          >
            {current.icon}
          </div>
          <div>
            <div className="text-[13.5px] font-bold tracking-tight text-brand-black">
              {current.title}
            </div>
            <div className="font-mono text-[10px] font-normal text-brand-muted">
              {current.sub}
            </div>
          </div>
          {isEnter && (
            <div
              key={displayIdx}
              className="absolute bottom-0 left-0 h-[3px] w-full origin-left animate-progress-bar bg-brand-black"
            />
          )}
        </div>
      </div>
    </div>
  );
}
