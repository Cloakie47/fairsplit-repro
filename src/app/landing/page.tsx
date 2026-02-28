"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f7f4fb] text-[#1f1a24]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <Link href="/landing" className="text-lg font-semibold tracking-tight text-[#6f47d8]">
          FairSplit
        </Link>
        <Link
          href="/app"
          className="rounded-full border border-[#d92ca0] bg-[#e83daa] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#d62e98]"
        >
          Enter App
        </Link>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="landing-glow absolute left-[6%] top-[8%] h-44 w-44 rounded-full bg-[#f7b8ee]" />
            <div className="landing-glow absolute right-[10%] top-[18%] h-36 w-36 rounded-full bg-[#c7b8ff]" />
          </div>
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 pb-16 pt-10 md:grid-cols-2 md:items-center md:px-8 md:pb-24 md:pt-14">
            <div className="landing-fade-up">
              <p className="mb-2 inline-flex rounded-full border border-[#e9d8f3] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.13em] text-[#6f47d8]">
                USDC Split Payments
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-[#5a37d1] md:text-6xl">
                Say hello to FairSplit
              </h1>
              <p className="mt-4 text-lg font-medium text-[#6f47d8]">
                FairSplit allows you to create split payments to share with frens, and opt in
                to confidentiality when needed.
              </p>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#5f5670] md:text-base">
                FairSplit is a USDC-first split payments app for friends, roommates, teams, and
                communities. Create expense splits, track who paid, send reminders, and settle
                transparently on-chain with optional confidential payments for privacy-sensitive
                moments.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/app"
                  className="rounded-full border border-[#d92ca0] bg-[#e83daa] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#d62e98]"
                >
                  Enter App
                </Link>
                <a
                  href="#how-it-works"
                  className="rounded-full border border-[#ddd3ea] bg-white px-5 py-2.5 text-sm font-semibold text-[#4a4158] transition hover:bg-[#f3edf9]"
                >
                  How it works
                </a>
              </div>
            </div>

            <div className="landing-fade-up md:justify-self-end">
              <div className="landing-float mx-auto w-full max-w-md rounded-3xl border border-[#ece5f6] bg-white/90 p-4">
                <div className="rounded-2xl bg-[#f5f1fb] p-4">
                  <p className="text-xs font-semibold text-[#7b7190]">Split total</p>
                  <p className="mt-1 text-3xl font-semibold text-[#2d2438]">$500.00</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-[#f9f6fd] p-3">
                    <p className="text-xs font-semibold text-[#7b7190]">Participants</p>
                    <p className="mt-1 text-lg font-semibold text-[#2d2438]">4 frens</p>
                  </div>
                  <div className="rounded-2xl bg-[#f9f6fd] p-3">
                    <p className="text-xs font-semibold text-[#7b7190]">Per person</p>
                    <p className="mt-1 text-lg font-semibold text-[#2d2438]">$125.00</p>
                  </div>
                </div>
                <div className="mt-3 rounded-2xl border border-[#ece5f6] bg-white p-3">
                  <p className="text-xs font-semibold text-[#7b7190]">Settlement mode</p>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#fce7f6] px-3 py-1 text-xs font-semibold text-[#b52280]">
                    Optional Confidential
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-3 w-full rounded-xl border border-[#d92ca0] bg-[#e83daa] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#d62e98]"
                >
                  Create split
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto w-full max-w-6xl px-5 pb-10 md:px-8">
          <div className="rounded-3xl border border-[#e7def1] bg-white/85 p-6">
            <h2 className="text-2xl font-semibold tracking-tight text-[#2d2438]">How it works</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-[#eee7f8] bg-[#fcfbfe] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7f7297]">
                  01
                </p>
                <p className="mt-1 text-sm font-semibold text-[#2d2438]">Create a split</p>
                <p className="mt-1 text-sm text-[#5f5670]">
                  Add total, participants, and notes in seconds.
                </p>
              </div>
              <div className="rounded-2xl border border-[#eee7f8] bg-[#fcfbfe] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7f7297]">
                  02
                </p>
                <p className="mt-1 text-sm font-semibold text-[#2d2438]">Track payments</p>
                <p className="mt-1 text-sm text-[#5f5670]">
                  See who paid, send reminders, and keep everyone synced.
                </p>
              </div>
              <div className="rounded-2xl border border-[#eee7f8] bg-[#fcfbfe] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7f7297]">
                  03
                </p>
                <p className="mt-1 text-sm font-semibold text-[#2d2438]">Settle on-chain</p>
                <p className="mt-1 text-sm text-[#5f5670]">
                  Pay transparently by default, or choose confidential mode when needed.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#e9e2f0] bg-[#f7f4fb]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-6 text-sm text-[#5f5670] md:flex-row md:items-center md:justify-between md:px-8">
          <p>FairSplit - USDC-first split payments</p>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[#5f5670] transition hover:text-[#1f1a24]"
            >
              Guide to GitHub ↗
            </a>
            <a
              href="#"
              className="font-medium text-[#5f5670] transition hover:text-[#1f1a24]"
            >
              Litepaper
            </a>
            <a
              href="#how-it-works"
              className="font-medium text-[#5f5670] transition hover:text-[#1f1a24]"
            >
              How it works
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
