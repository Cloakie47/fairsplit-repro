"use client";

import { Topbar } from "@/components/layout/Topbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { ToastHost } from "@/components/ToastHost";

interface LayoutShellProps {
  children: React.ReactNode;
}

export function LayoutShell({ children }: LayoutShellProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-brand-bg">
      <Sidebar />
      <div className="md:pl-56">
        <Topbar />
        <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-24 md:px-5 md:py-8 md:pb-8">
          {children}
        </main>
      </div>
      <MobileBottomNav />
      <ToastHost />
    </div>
  );
}
