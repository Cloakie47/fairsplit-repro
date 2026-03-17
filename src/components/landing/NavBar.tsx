"use client";

import Link from "next/link";

export function NavBar() {
  return (
    <nav className="fixed left-0 right-0 top-0 z-[100] flex h-14 items-center justify-between border-b-2 border-brand-black bg-brand-black px-6 md:px-10">
      <div className="font-mono flex items-center gap-2.5 text-base font-bold uppercase tracking-wider text-brand-yellow">
        Fairsplit
      </div>
      <div className="flex items-center">
        <div className="flex items-center border border-white/15">
          <Link
            href="#how"
            className="border-r border-white/15 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-white/60 transition hover:bg-brand-yellow/15 hover:text-brand-yellow"
          >
            How it works
          </Link>
          <Link
            href="https://www.notion.so/Fairsplit-Litepaper-3176ffa741d78024badbe45e9c892a14"
            target="_blank"
            rel="noopener noreferrer"
            className="border-r border-white/15 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-white/60 transition hover:bg-brand-yellow/15 hover:text-brand-yellow"
          >
            Litepaper
          </Link>
          <Link
            href="https://github.com/Cloakie47/fairsplit-repro"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-white/60 transition hover:bg-brand-yellow/15 hover:text-brand-yellow"
          >
            GitHub
          </Link>
        </div>
        <Link
          href="/create-bill"
          className="ml-3.5 border-2 border-brand-yellow bg-brand-yellow px-5 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-brand-black shadow-[3px_3px_0_rgba(212,245,162,0.4)] transition hover:bg-white hover:shadow-[4px_4px_0_#D4F5A2] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
        >
          Launch App →
        </Link>
      </div>
    </nav>
  );
}
