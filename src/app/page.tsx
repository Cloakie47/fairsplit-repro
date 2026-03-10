"use client";

import Link from "next/link";
import Script from "next/script";
import { createElement } from "react";

export default function LandingHomePage() {
  return (
    <>
      <Script
        src="https://unpkg.com/@dotlottie/player-component@latest/dist/dotlottie-player.mjs"
        type="module"
        strategy="afterInteractive"
      />
      <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_10%_16%,rgba(59,130,246,0.2),transparent_34%),radial-gradient(circle_at_84%_20%,rgba(14,165,233,0.16),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#f4f8ff_100%)] text-[#0f172a]">
        <div className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-[0.78]">
          {createElement("dotlottie-player", {
            src: "https://assets-v2.lottiefiles.com/a/926b5f5e-117a-11ee-b83d-df9534a9fcf0/DhEx6yntOU.lottie",
            background: "transparent",
            speed: "0.6",
            loop: true,
            autoplay: true,
            style: { width: "100%", height: "100%" },
          })}
        </div>
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(248,250,255,0.42),rgba(255,255,255,0.68))]" />
        <div className="landing-glow pointer-events-none fixed -left-16 top-28 -z-10 h-64 w-64 rounded-full bg-blue-300/30 blur-3xl" />
        <div className="landing-glow pointer-events-none fixed right-10 top-20 -z-10 h-52 w-52 rounded-full bg-cyan-300/25 blur-3xl" />

        <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-7 md:px-10">
          <h1 className="text-2xl font-bold tracking-tight text-[#1e293b] md:text-4xl">Fairsplit</h1>
          <Link
            href="/app"
            className="rounded-full border border-[#2563eb] bg-[#3b82f6] px-6 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#2563eb]"
          >
            Launch App
          </Link>
        </header>

        <main className="mx-auto w-full max-w-[1200px] px-6 pb-28 pt-20 md:px-10 md:pt-32">
          <section className="landing-fade-up max-w-6xl">
            <p className="inline-flex rounded-full border border-slate-200 bg-white/95 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] text-[#1e40af]">
              STABLE TOKEN SPLIT PAYMENTS
            </p>
            <h2 className="mt-7 max-w-[1100px] text-5xl font-bold leading-[1.02] tracking-tight text-[#0f172a] md:text-7xl">
              Say, Hello to Fairsplit
            </h2>
            <p className="mt-5 max-w-3xl text-lg font-medium text-[#334155] md:text-[2rem] md:leading-tight">
              Split stable tokens. Reveal only what&apos;s required.
            </p>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#64748b] md:text-xl">
              Create expense splits, track who paid, send reminders, and settle on-chain with
              direct and confidential transfers.
            </p>

            <div className="mt-11">
              <Link
                href="/app"
                className="rounded-full border border-[#2563eb] bg-[#2563eb] px-8 py-4 text-lg font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#1d4ed8]"
              >
                Launch App
              </Link>
            </div>
          </section>
        </main>

        <footer className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/92 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-[1200px] items-center justify-end gap-4 px-6 py-3 text-sm font-medium text-slate-600 md:px-10">
            <a
              href="https://www.notion.so/End-User-Guide-How-People-Use-FairSplit-3176ffa741d780ba93c5f4ae6975feac?source=copy_link"
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-[#0f172a]"
            >
              How it works
            </a>
            <span className="text-slate-300">|</span>
            <a
              href="https://www.notion.so/Fairsplit-Litepaper-3176ffa741d78024badbe45e9c892a14?source=copy_link"
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-[#0f172a]"
            >
              Litepaper
            </a>
            <span className="text-slate-300">|</span>
            <a
              href="https://github.com/Cloakie47/fairsplit-repro"
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-[#0f172a]"
            >
              GitHub
            </a>
          </div>
        </footer>
      </div>
    </>
  );
}
