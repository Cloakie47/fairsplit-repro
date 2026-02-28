"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useChainTheme, CHAIN_GRADIENTS, CHAIN_ACCENT } from "@/lib/theme";
import { WalletConnectSafe } from "./WalletConnectSafe";
import { ProfileSetup } from "./ProfileSetup";
import { NotificationBell } from "./NotificationBell";
import { ToastHost } from "./ToastHost";

type LayoutShellProps = {
  children: React.ReactNode;
};

export function LayoutShell({ children }: LayoutShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useChainTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const resolvedTheme = mounted ? theme : "neutral";
  const gradient = CHAIN_GRADIENTS[resolvedTheme];
  const accent = CHAIN_ACCENT[resolvedTheme];
  const chainLabel =
    resolvedTheme === "blue" ? "Base" : resolvedTheme === "orange" ? "Arc" : "Network";
  const chainAura =
    resolvedTheme === "blue"
      ? "bg-[radial-gradient(circle_at_12%_10%,rgba(37,99,235,0.44),transparent_48%),radial-gradient(circle_at_88%_8%,rgba(96,165,250,0.35),transparent_40%)]"
      : resolvedTheme === "orange"
      ? "bg-[radial-gradient(circle_at_12%_10%,rgba(249,115,22,0.44),transparent_48%),radial-gradient(circle_at_88%_8%,rgba(251,191,36,0.35),transparent_40%)]"
      : "bg-[radial-gradient(circle_at_12%_10%,rgba(120,113,108,0.2),transparent_44%),radial-gradient(circle_at_88%_8%,rgba(120,113,108,0.14),transparent_36%)]";

  const primaryNav = [
    { href: "/create-bill", label: "Create Bill" },
    { href: "/confidential", label: "Confidential Wallet" },
    { href: "/activity", label: "Activity" },
    { href: "/app", label: "Pay now" },
    { href: "/requests", label: "Requests" },
    { href: "/friends", label: "Friends" },
    { href: "/profile", label: "Profile" },
  ];

  const navItemClass = (isActive: boolean) =>
    `sidebar-link ${isActive ? "sidebar-link-active" : ""}`;

  return (
    <div className={`relative min-h-screen overflow-hidden bg-gradient-to-br ${gradient} transition-all duration-500`}>
      <div className={`pointer-events-none absolute inset-0 opacity-95 ${chainAura} transition-all duration-500`} />
      <div
        className={`pointer-events-none absolute -right-20 top-10 h-56 w-56 rounded-full ${accent.light} opacity-45 blur-2xl transition-all duration-500`}
      />
      <div className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block">
        <span
          className={`dandelion-seed seed-one ${resolvedTheme === "blue" ? "seed-blue" : resolvedTheme === "orange" ? "seed-orange" : "seed-neutral"}`}
        />
        <span
          className={`dandelion-seed seed-two ${resolvedTheme === "blue" ? "seed-blue" : resolvedTheme === "orange" ? "seed-orange" : "seed-neutral"}`}
        />
        <span
          className={`dandelion-seed seed-three ${resolvedTheme === "blue" ? "seed-blue" : resolvedTheme === "orange" ? "seed-orange" : "seed-neutral"}`}
        />
        <span
          className={`dandelion-seed seed-four ${resolvedTheme === "blue" ? "seed-blue" : resolvedTheme === "orange" ? "seed-orange" : "seed-neutral"}`}
        />
        <span
          className={`dandelion-seed seed-five ${resolvedTheme === "blue" ? "seed-blue" : resolvedTheme === "orange" ? "seed-orange" : "seed-neutral"}`}
        />
        <span
          className={`dandelion-seed seed-six ${resolvedTheme === "blue" ? "seed-blue" : resolvedTheme === "orange" ? "seed-orange" : "seed-neutral"}`}
        />
      </div>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-white/10 bg-[#0b0b0b] text-white md:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <Link href="/app" className="text-2xl font-semibold tracking-tight text-white">
            FairSplit
          </Link>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-white/55">
            {chainLabel}
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-2 px-3 py-4">
          {primaryNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={navItemClass(isActive)}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="relative z-10 pb-10 md:pl-56">
        <header className="header-shell">
          <div className="px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
              <div className="flex items-center gap-3 md:hidden">
                <Link
                  href="/app"
                  className={`text-3xl font-semibold tracking-tight leading-none ${accent.text} transition-colors`}
                >
                  FairSplit
                </Link>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${accent.border} ${accent.text} bg-white/90`}
                >
                  {chainLabel}
                </span>
              </div>

              <div className="mb-2 overflow-x-auto md:hidden">
                <label className="sr-only" htmlFor="mobile-nav">
                  Navigate
                </label>
                <div className="rounded-xl border border-stone-200 bg-white/90 p-1.5">
                  <select
                    id="mobile-nav"
                    value={primaryNav.some((item) => item.href === pathname) ? pathname : "/app"}
                    onChange={(e) => router.push(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 outline-none focus:ring-2 focus:ring-stone-300"
                  >
                    {primaryNav.map((item) => (
                      <option key={item.href} value={item.href}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-2 md:justify-end">
                <NotificationBell />
                <WalletConnectSafe accent={accent} />
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-4xl px-5 pt-6">{children}</main>
      </div>
      <ProfileSetup />
      <ToastHost />
    </div>
  );
}
