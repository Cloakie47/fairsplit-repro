"use client";

import { useEffect, useRef, useState } from "react";

const DOT_COLORS: Record<string, string> = {
  yellow: "#D4F5A2",
  red: "#E8000D",
  black: "#0A0A0A",
};

const FEATURES = [
  {
    num: "01",
    icon: "⚡",
    dotColor: DOT_COLORS.yellow,
    title: "Create and Track Shared Expenses",
    desc: "Create a USDC expense split, add participants, and track who has paid. Each payment updates the on-chain bill state, giving everyone a verifiable record of the settlement.",
  },
  {
    num: "02",
    icon: "🔒",
    dotColor: DOT_COLORS.red,
    title: "Optional Confidential Settlement",
    desc: "Choose how payments are made. Participants can pay publicly with standard USDC transfers or use confidential settlement powered by Fairblock, where only their own payment details are revealed.",
  },
  {
    num: "03",
    icon: "⛓️",
    dotColor: DOT_COLORS.black,
    title: "On-Chain Expense State",
    desc: "Fairsplit smart contracts track every bill and participant payment directly on-chain. When someone settles their share with USDC, the contract updates the payment status, creating a verifiable record of the split that anyone can confirm through the blockchain.",
  },
];

export function FeatureCards() {
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
      className={`grid grid-cols-1 border-t-2 border-b-2 border-brand-black md:grid-cols-3 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ transition: "opacity 0.5s ease, transform 0.5s ease" }}
    >
      {FEATURES.map((f, i) => (
        <div
          key={f.num}
          className="relative overflow-hidden border-r-2 border-brand-black bg-white p-11 transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-brand-cream hover:shadow-brutal-lg hover:z-10 md:px-11"
          style={{
            opacity: childVisible ? 1 : 0,
            transform: childVisible ? "translateY(0)" : "translateY(18px)",
            transition: `opacity 0.4s ease ${i * 90 + 60}ms, transform 0.4s ease ${i * 90 + 60}ms, background 0.12s, box-shadow 0.1s`,
          }}
        >
          <div
            className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 border-2 border-brand-black"
            style={{ backgroundColor: f.dotColor }}
          />
          <div className="mb-4 flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-brand-muted">
            <span className="h-0.5 w-6 bg-brand-red" />
            {f.num}
          </div>
          <div className="mb-5 flex h-[52px] w-[52px] items-center justify-center border-2 border-brand-black bg-brand-yellow text-[22px] shadow-brutal transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal-lg">
            {f.icon}
          </div>
          <h3 className="mb-2.5 text-xl font-bold uppercase tracking-tight text-brand-black">
            {f.title}
          </h3>
          <p className="text-sm font-normal leading-relaxed text-brand-muted">
            {f.desc}
          </p>
        </div>
      ))}
    </section>
  );
}
