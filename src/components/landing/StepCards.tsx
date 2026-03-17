"use client";

import { useEffect, useRef, useState } from "react";

const STEPS = [
  {
    num: "01",
    title: "Create a Split",
    desc: "Name the expense, set the total amount in USDC, and choose how payments should settle, public transfer or confidential settlement.",
  },
  {
    num: "02",
    title: "Add Participants",
    desc: "Add people by wallet address, ENS, or Basename. Fairsplit calculates each participant's share and records the split on-chain.",
  },
  {
    num: "03",
    title: "Track Payments",
    desc: "The contract tracks participant payment status in real time. You can see who has paid, who hasn't, and send reminders to pending participants.",
  },
  {
    num: "04",
    title: "Settle Your Share",
    desc: "Participants pay their share directly from their wallet using USDC. The contract updates the bill state on-chain, creating a verifiable record of the settlement.",
  },
];

export function StepCards() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [childVisible, setChildVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setVisible(true);
        const t = setTimeout(() => setChildVisible(true), 60);
        return () => clearTimeout(t);
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="how"
      className={`border-b-2 border-brand-black bg-brand-bg py-20 px-12 md:px-16 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ transition: "opacity 0.5s ease, transform 0.5s ease" }}
    >
      <div className="mb-12 flex items-end justify-between border-b-2 border-brand-black pb-6">
        <div>
          <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-brand-muted">
            <span className="text-brand-red">//</span> Process
          </div>
          <h2 className="text-4xl font-bold uppercase tracking-tight text-brand-black">
            How it works
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 border-2 border-brand-black shadow-brutal-xl md:grid-cols-4">
        {STEPS.map((s, i) => (
          <div
            key={s.num}
            className="relative border-r-2 border-brand-black bg-white p-8 transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-brand-yellow hover:shadow-brutal-lg hover:z-10 last:border-r-0"
            style={{
              opacity: childVisible ? 1 : 0,
              transform: childVisible ? "translateY(0)" : "translateY(18px)",
              transition: `opacity 0.4s ease ${i * 90 + 60}ms, transform 0.4s ease ${i * 90 + 60}ms`,
            }}
          >
            <div className="mb-4 text-[44px] font-bold leading-none tracking-tight text-brand-black opacity-[0.12]">
              {s.num}
            </div>
            <h3 className="mb-2 text-base font-bold uppercase tracking-tight text-brand-black">
              {s.title}
            </h3>
            <p className="text-[13px] font-normal leading-relaxed text-brand-muted">
              {s.desc}
            </p>
            {i < STEPS.length - 1 && (
              <div className="absolute -right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center border-2 border-brand-black bg-brand-yellow text-sm font-bold text-brand-black">
                →
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
