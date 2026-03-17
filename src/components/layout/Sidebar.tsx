"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

interface NavItem {
  href: string;
  label: string;
  section: "payments" | "account";
}

const NAV_ITEMS: NavItem[] = [
  { href: "/create-bill", label: "Create Bill", section: "payments" },
  { href: "/pay", label: "Pay now", section: "payments" },
  { href: "/requests", label: "Requests", section: "payments" },
  { href: "/bridge", label: "Bridge", section: "payments" },
  { href: "/friends", label: "Friends", section: "account" },
  { href: "/confidential", label: "Confidential Wallet", section: "account" },
  { href: "/activity", label: "Activity", section: "account" },
  { href: "/profile", label: "Profile", section: "account" },
];

export function Sidebar() {
  const pathname = usePathname();

  const paymentItems = NAV_ITEMS.filter((n) => n.section === "payments");
  const accountItems = NAV_ITEMS.filter((n) => n.section === "account");

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r-2 border-brand-black bg-white md:flex">
      <div className="border-b-2 border-brand-black px-5 py-5">
        <Link
          href="/pay"
          className="font-grotesk text-2xl font-bold uppercase text-brand-black"
        >
          FairSplit
        </Link>
      </div>

      <nav className="flex flex-1 flex-col px-3 py-4">
        <p className="label-text mb-2 px-2 text-brand-muted">Payments</p>
        {paymentItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "mb-1 block border-2 px-3 py-2 font-grotesk text-sm font-bold transition-all duration-75",
                isActive
                  ? "border-brand-black bg-brand-black text-brand-yellow"
                  : "border-transparent text-brand-ink hover:border-brand-black hover:bg-brand-yellow hover:text-brand-black"
              )}
            >
              {item.label}
            </Link>
          );
        })}

        <p className="label-text mb-2 mt-6 px-2 text-brand-muted">Account</p>
        {accountItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "mb-1 block border-2 px-3 py-2 font-grotesk text-sm font-bold transition-all duration-75",
                isActive
                  ? "border-brand-black bg-brand-black text-brand-yellow"
                  : "border-transparent text-brand-ink hover:border-brand-black hover:bg-brand-yellow hover:text-brand-black"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t-2 border-brand-black px-4 py-3">
        <p className="font-mono text-label text-brand-muted">
          USDC on Base · Arc · Tempo
        </p>
      </div>
    </aside>
  );
}
