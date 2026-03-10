"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { LayoutShell } from "@/components/LayoutShell";
import { DirectPaymentCard } from "@/components/DirectPaymentCard";
import { SUPPORTED_CHAINS } from "@/lib/chains";

export default function AppHomePage() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isTempo = chainId === SUPPORTED_CHAINS.tempoTestnet.id;

  return (
    <LayoutShell>
      {!mounted ? (
        <div className="mx-auto max-w-2xl rounded-2xl border border-stone-200 bg-white/95 p-6 text-center">
          <p className="text-base font-medium text-stone-700">Loading your wallet session...</p>
        </div>
      ) : !isConnected ? (
        <div className="mx-auto max-w-2xl rounded-2xl border border-stone-200 bg-white/95 p-6 text-center">
          <p className="text-base font-medium text-stone-700">
            Connect your wallet to create and view splits.
          </p>
          <div className="mt-4 flex flex-col items-center gap-2">
            <p className="text-sm text-stone-500">
              Use the Connect Wallet button in the top-right corner.
            </p>
          </div>
        </div>
      ) : (
        <>
          {isTempo && (
            <div className="mx-auto mb-5 max-w-2xl rounded-2xl border border-slate-300 bg-white/95 p-5">
              <p className="text-sm font-semibold text-slate-900">Tempo dashboard preview is live</p>
              <p className="mt-1.5 text-sm text-slate-600">
                Wallet switching and dashboard theming are enabled on Tempo. Multi-token split creation,
                direct transfers, and confidential balances are the next integration step.
              </p>
            </div>
          )}
          <div className="mx-auto mb-5 max-w-2xl rounded-2xl border border-stone-200 bg-white/95 p-5">
            <h2 className="text-2xl font-semibold tracking-tight text-stone-900">
              Split bills with friends
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm text-stone-600">
              Create a split, add participants, and settle with supported stable tokens. Track who
              paid and who hasn&apos;t.
            </p>
          </div>

          <div className="mx-auto max-w-2xl rounded-2xl border border-stone-200 bg-white/95 p-5 text-center">
            <p className="text-sm text-stone-600">
              Create a new split to request stable token payments from friends.
            </p>
            <Link
              href="/create-bill"
              className="mt-4 inline-flex items-center justify-center rounded-xl border border-[#d56ac7] bg-[#f7b8ee] px-5 py-2.5 text-sm font-semibold text-stone-900 transition hover:brightness-95"
            >
              Create your split
            </Link>
          </div>

          <div className="mx-auto mt-5 max-w-2xl">
            <DirectPaymentCard />
          </div>
        </>
      )}
    </LayoutShell>
  );
}
