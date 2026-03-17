"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount } from "wagmi";
import {
  getNotificationsForUser,
  getUnreadCount,
  markAllNotificationsRead,
  subscribeNotifications,
} from "@/lib/notifications";

export function NotificationBell() {
  const { address, isConnected } = useAccount();
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeNotifications(() => setTick((v) => v + 1));
    return unsubscribe;
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const updatePosition = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const panelWidth = Math.min(384, Math.max(280, window.innerWidth - 24));
      const margin = 12;
      const left = Math.max(
        margin,
        Math.min(window.innerWidth - panelWidth - margin, rect.right - panelWidth)
      );
      setPanelStyle({ top: rect.bottom + 8, left, width: panelWidth });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      const panel = document.querySelector("[data-alerts-panel]");
      if (panel?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const notifications = useMemo(
    () => (address ? getNotificationsForUser(address) : []),
    [address, tick]
  );
  const unread = useMemo(
    () => (address ? getUnreadCount(address) : 0),
    [address, tick]
  );

  // Avoid SSR/CSR wallet-state mismatch on initial hydration.
  if (!mounted) return null;
  if (!isConnected || !address) return null;

  const handleReadAll = () => {
    markAllNotificationsRead(address);
    setTick((v) => v + 1);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative border-2 border-brand-black bg-brand-red px-3 py-2 font-grotesk text-xs font-bold uppercase text-white shadow-brutal transition-all duration-75 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none md:px-4 md:py-2.5 md:text-sm"
      >
        {unread > 0 && <span className="mr-1.5">●</span>}
        Alerts
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center border-2 border-brand-black bg-white px-1 font-mono text-[10px] font-bold text-brand-black">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {mounted &&
        open &&
        panelStyle &&
        createPortal(
          <div
            data-alerts-panel
            className="fixed z-[220] border-2 border-brand-black bg-white p-4 shadow-brutal-lg"
            style={{ top: panelStyle.top, left: panelStyle.left, width: panelStyle.width }}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-stone-900">Notifications</p>
              <button
                type="button"
                onClick={handleReadAll}
                className="text-xs font-semibold text-stone-600 hover:text-stone-900"
              >
                Mark all read
              </button>
            </div>
            {notifications.length === 0 ? (
              <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">
                No alerts yet.
              </p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-auto pr-1">
                {notifications.slice(0, 8).map((n) => (
                  <li
                    key={n.id}
                    className={`rounded-xl border px-3 py-2 ${
                      n.isRead
                        ? "border-stone-200 bg-white"
                        : "border-stone-300 bg-stone-50"
                    }`}
                  >
                    <p className="text-sm font-medium text-stone-900">{n.title}</p>
                    <p className="text-xs text-stone-600">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/requests"
              onClick={() => setOpen(false)}
              className="mt-3 inline-block text-xs font-semibold text-stone-700 hover:text-stone-900"
            >
              Open Requests →
            </Link>
          </div>,
          document.body
        )}
    </div>
  );
}

