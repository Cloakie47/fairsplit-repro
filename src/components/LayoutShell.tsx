"use client";

import { Topbar } from "@/components/layout/Topbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { ToastHost } from "@/components/ToastHost";

interface LayoutShellProps {
  children: React.ReactNode;
}

export function LayoutShell({ children }: LayoutShellProps) {
  return (
    <div className="min-h-screen bg-brand-bg">
      <Sidebar />
      <div className="md:pl-56">
        <Topbar />
        <main className="mx-auto w-full max-w-5xl px-5 py-8">{children}</main>
      </div>
      <ToastHost />
    </div>
  );
}
