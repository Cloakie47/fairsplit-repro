import Link from "next/link";
import { NavBar } from "@/components/landing/NavBar";
import { HeroDemo } from "@/components/landing/HeroDemo";
import { Ticker } from "@/components/landing/Ticker";
import { FeatureCards } from "@/components/landing/FeatureCards";
import { StepCards } from "@/components/landing/StepCards";

export default function LandingPage() {
  return (
    <>
      <NavBar />
      <section className="flex min-h-screen flex-col pt-14">
        <div className="flex flex-1 flex-col border-b-2 border-brand-black md:flex-row">
          <div className="flex flex-1 flex-col justify-center border-r-2 border-brand-black bg-brand-bg px-12 py-20 md:px-16 md:py-20">
            <div className="mb-8 inline-flex w-fit animate-smack-in items-center gap-2 border-2 border-brand-black bg-brand-yellow px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-brand-black shadow-brutal">
              Stable Token Split Payments
            </div>
            <h1 className="mb-6 text-[clamp(44px,5.5vw,72px)] font-bold leading-none tracking-tight text-brand-black uppercase">
              <span className="inline-block animate-word-in opacity-0 [animation-delay:0.3s] [animation-fill-mode:forwards]">
                Say,&nbsp;
              </span>
              <span className="inline-block animate-word-in opacity-0 [animation-delay:0.42s] [animation-fill-mode:forwards]">
                Hello&nbsp;
              </span>
              <span className="inline-block animate-word-in opacity-0 [animation-delay:0.54s] [animation-fill-mode:forwards]">
                to&nbsp;
              </span>
              <span className="inline-block animate-word-in opacity-0 [animation-delay:0.66s] [animation-fill-mode:forwards]">
                Fairsplit
              </span>
            </h1>
            <p className="mb-3.5 animate-fade-up text-xl font-semibold tracking-tight text-brand-ink [animation-delay:0.8s] [animation-fill-mode:both]">
              Split stable tokens. Reveal only what&apos;s required.
            </p>
            <p className="mb-10 max-w-[420px] animate-fade-up text-[15px] font-normal leading-relaxed text-brand-muted [animation-delay:0.95s] [animation-fill-mode:both]">
              Create expense splits, track who paid, send reminders, and settle
              on-chain with direct and confidential transfers.
            </p>
            <div className="mb-10 flex animate-fade-up gap-3.5 [animation-delay:1.1s] [animation-fill-mode:both]">
              <Link
                href="/create-bill"
                className="inline-flex items-center gap-2 border-2 border-brand-black bg-brand-red px-7 py-3.5 font-mono text-[13px] font-bold uppercase tracking-wider text-white shadow-brutal-lg transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal-xl active:translate-x-1.5 active:translate-y-1.5 active:shadow-none"
              >
                Launch App
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 7h8M8 4l3 3-3 3" />
                </svg>
              </Link>
              <Link
                href="#how"
                className="inline-flex items-center gap-2 border-2 border-brand-black bg-white px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-brand-black shadow-brutal transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-brand-cream hover:shadow-brutal-lg active:translate-x-1 active:translate-y-1 active:shadow-none"
              >
                How it works
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-2 animate-fade-up font-mono text-[10px] font-normal uppercase tracking-widest text-brand-muted [animation-delay:1.25s] [animation-fill-mode:both]">
              <span className="inline-flex items-center gap-1.5 border-[1.5px] border-brand-black bg-brand-black px-2 py-0.5 font-bold text-brand-yellow">
                Arc Testnet
              </span>
              <span className="inline-flex items-center gap-1.5 border-[1.5px] border-brand-black bg-brand-black px-2 py-0.5 font-bold text-brand-yellow">
                Base Testnet
              </span>
              <span className="inline-flex items-center gap-1.5 border-[1.5px] border-brand-black bg-brand-black px-2 py-0.5 font-bold text-brand-yellow">
                Tempo Testnet
              </span>
              <span className="inline-flex items-center gap-1.5 border-[1.5px] border-brand-muted bg-white px-2 py-0.5 font-bold text-brand-muted">
                USDC Bridging
              </span>
            </div>
          </div>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-white px-12 py-16 md:px-14 md:py-16">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `linear-gradient(rgba(10,10,10,0.03) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(10,10,10,0.03) 1px, transparent 1px)`,
                backgroundSize: "40px 40px",
              }}
            />
            <HeroDemo />
          </div>
        </div>
        <Ticker />
      </section>

      <FeatureCards />

      <StepCards />

      <section
        className="grid grid-cols-1 items-center gap-10 border-b-2 border-brand-black bg-brand-black px-12 py-16 md:grid-cols-[1fr_auto] md:px-16"
        style={{
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 select-none font-mono text-[160px] font-bold leading-none tracking-tight text-brand-yellow/5"
          style={{ letterSpacing: "-8px" }}
          aria-hidden
        >
          SPLIT
        </div>
        <div className="relative">
          <h2 className="mb-3.5 text-[clamp(28px,3.5vw,46px)] font-bold leading-tight tracking-tight text-white uppercase">
            Ready to <em className="font-normal not-italic text-brand-yellow">split fairly</em>?
          </h2>
          <p className="max-w-[480px] text-[15px] font-normal leading-relaxed text-white/50">
            Connect your wallet and start splitting on Arc, Base, or Tempo
            testnets. More networks coming soon.
          </p>
        </div>
        <div className="flex flex-col gap-3 md:flex-shrink-0">
          <Link
            href="/create-bill"
            className="inline-flex items-center gap-2 border-2.5 border-brand-yellow bg-brand-yellow px-9 py-4 font-mono text-[13px] font-bold uppercase tracking-wider text-brand-black shadow-brutal-lg transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-white hover:bg-white hover:shadow-brutal-xl active:translate-x-1.5 active:translate-y-1.5 active:shadow-none"
          >
            Launch App
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 7h8M8 4l3 3-3 3" />
            </svg>
          </Link>
          <Link
            href="https://github.com/Cloakie47/fairsplit-repro"
            target="_blank"
            rel="noopener noreferrer"
            className="block border-2 border-white/20 bg-transparent px-7 py-3 text-center font-mono text-[11px] font-bold uppercase tracking-widest text-white/50 transition hover:border-white/50 hover:text-white"
          >
            View on GitHub
          </Link>
        </div>
      </section>

      <footer className="flex items-center justify-between border-t-2 border-brand-black bg-brand-black px-10 py-6">
        <div className="font-mono text-[13px] font-bold uppercase tracking-wider text-brand-yellow">
          Fairsplit ✦
        </div>
        <div className="flex items-center border border-white/15">
          <Link
            href="https://www.notion.so/End-User-Guide-How-People-Use-FairSplit-3176ffa741d780ba93c5f4ae6975feac"
            target="_blank"
            rel="noopener noreferrer"
            className="border-r border-white/15 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-white/40 transition hover:bg-brand-yellow/10 hover:text-brand-yellow"
          >
            How it works
          </Link>
          <Link
            href="https://www.notion.so/Fairsplit-Litepaper-3176ffa741d78024badbe45e9c892a14"
            target="_blank"
            rel="noopener noreferrer"
            className="border-r border-white/15 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-white/40 transition hover:bg-brand-yellow/10 hover:text-brand-yellow"
          >
            Litepaper
          </Link>
          <Link
            href="https://github.com/Cloakie47/fairsplit-repro"
            target="_blank"
            rel="noopener noreferrer"
            className="border-r border-white/15 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-white/40 transition hover:bg-brand-yellow/10 hover:text-brand-yellow"
          >
            GitHub
          </Link>
          <Link
            href="https://x.com/0xfairsplit"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-white/40 transition hover:bg-brand-yellow/10 hover:text-brand-yellow"
          >
            Twitter
          </Link>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-white/20">
          © 2025 Fairsplit
        </div>
      </footer>
    </>
  );
}
