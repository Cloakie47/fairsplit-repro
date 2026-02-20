"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { LayoutShell } from "@/components/LayoutShell";
import { DirectPaymentCard } from "@/components/DirectPaymentCard";

export default function HomePage() {
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <LayoutShell>
      {!mounted ? (
        <div className="rounded-3xl border border-white/70 bg-white/85 p-10 text-center shadow-xl backdrop-blur">
          <p className="text-lg font-medium text-stone-700">Loading your wallet session...</p>
        </div>
      ) : !isConnected ? (
        <div className="rounded-3xl border border-white/70 bg-white/85 p-10 text-center shadow-xl backdrop-blur">
          <p className="text-lg font-medium text-stone-700">
            Connect your wallet to create and view splits.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <p className="text-sm text-stone-500">
              Use the Connect Wallet button in the top-right corner.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-10 rounded-3xl border border-white/70 bg-white/80 p-8 shadow-xl backdrop-blur">
            <h2 className="text-3xl font-semibold tracking-tight text-stone-900">
              Split bills with friends
            </h2>
            <p className="mt-2 max-w-2xl text-base text-stone-600">
              Create a split, add participants, and settle in USDC. Track who paid and who hasn&apos;t.
            </p>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/80 p-10 text-center shadow-xl backdrop-blur">
            <p className="text-base text-stone-600">
              Create a new split to request USDC payments from friends.
            </p>
            <Link
              href="/create-bill"
              className="mt-6 inline-flex items-center justify-center rounded-2xl bg-black px-8 py-4 text-base font-bold text-white shadow-lg transition hover:bg-zinc-800 hover:shadow-xl"
            >
              Create your split
            </Link>
          </div>

          <div className="mt-8">
            <DirectPaymentCard />
          </div>
        </>
      )}
    </LayoutShell>
  );
}
