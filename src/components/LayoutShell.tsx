"use client";

import { Topbar } from "@/components/layout/Topbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { ToastHost } from "@/components/ToastHost";

interface LayoutShellProps {
  children: React.ReactNode;
  /**
   * Widens the content column from 5xl to 7xl. The dense FairEats storefront
   * needs it: a category rail, four to five menu cards and a docked cart do
   * not fit in 1024px.
   */
  wide?: boolean;
}

export function LayoutShell({ children, wide = false }: LayoutShellProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-brand-bg">
      <Sidebar />
      <div className="md:pl-56">
        <Topbar />
        <main
          className={
            "mx-auto w-full px-4 py-6 pb-24 md:px-5 md:py-8 md:pb-8 " +
            (wide ? "max-w-7xl" : "max-w-5xl")
          }
        >
          {children}
        </main>
      </div>
      <MobileBottomNav />
      <ToastHost />
    </div>
  );
}
