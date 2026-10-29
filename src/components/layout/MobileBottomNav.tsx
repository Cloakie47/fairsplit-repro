"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

type MobileNavItem = {
  href: string;
  label: string;
  key: "home" | "create" | "pay" | "requests" | "more";
};

const NAV_ITEMS: MobileNavItem[] = [
  { href: "/app", label: "Home", key: "home" },
  { href: "/create-bill", label: "Create", key: "create" },
  { href: "/pay", label: "Pay", key: "pay" },
  { href: "/requests", label: "Requests", key: "requests" },
  { href: "/profile", label: "More", key: "more" },
];

function isActive(pathname: string, item: MobileNavItem): boolean {
  if (item.key === "home") return pathname === "/" || pathname.startsWith("/app");
  if (item.key === "more") {
    return (
      pathname.startsWith("/businesses") ||
      pathname.startsWith("/profile") ||
      pathname.startsWith("/friends") ||
      pathname.startsWith("/activity") ||
      pathname.startsWith("/confidential") ||
      pathname.startsWith("/bridge")
    );
  }
  return pathname.startsWith(item.href);
}

function Icon({ kind }: { kind: MobileNavItem["key"] }) {
  if (kind === "home") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 11.5L12 4l9 7.5" />
        <path d="M5 10.5V20h14v-9.5" />
      </svg>
    );
  }
  if (kind === "create") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  }
  if (kind === "pay") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 7h18v10H3z" />
        <path d="M7 12h4" />
      </svg>
    );
  }
  if (kind === "requests") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h.01M12 12h.01M19 12h.01" />
    </svg>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-brand-black bg-brand-black md:hidden">
      <div className="grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[56px] flex-col items-center justify-center gap-1 border-r border-brand-bg/20 font-mono text-[10px] uppercase tracking-wide",
                "last:border-r-0",
                active ? "bg-brand-lime text-brand-black" : "text-brand-bg"
              )}
            >
              <Icon kind={item.key} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

