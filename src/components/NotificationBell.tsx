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
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number } | null>(
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
      const panelWidth = 384;
      const margin = 12;
      const left = Math.max(
        margin,
        Math.min(window.innerWidth - panelWidth - margin, rect.right - panelWidth)
      );
      setPanelStyle({ top: rect.bottom + 8, left });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
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
        className="nav-pill relative px-4 py-2.5 text-sm font-semibold"
      >
        Alerts
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {mounted &&
        open &&
        panelStyle &&
        createPortal(
          <div
            className="fixed z-[220] w-96 rounded-2xl border border-stone-200 bg-white p-3"
            style={{ top: panelStyle.top, left: panelStyle.left }}
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

