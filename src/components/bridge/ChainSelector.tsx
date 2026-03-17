"use client";

import { useState, useEffect } from "react";

const CHAINS = ["Base Sepolia", "Arc Testnet", "Tempo Testnet"] as const;

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

const CHAIN_NAME_TO_ID: Record<string, number> = {
  "Base Sepolia": 84532,
  "Arc Testnet": 5042002,
  "Tempo Testnet": 42431,
};

export function getChainIdFromName(name: string): number | null {
  return CHAIN_NAME_TO_ID[name] ?? null;
}

export function isChainBridgable(chainName: string): boolean {
  const id = CHAIN_NAME_TO_ID[chainName];
  return id === 84532 || id === 5042002;
}

interface BridgeSelectorProps {
  sourceBalance?: string;
  destBalance?: string;
  onFromToChange?: (fromChain: string, toChain: string) => void;
  onBridge?: (params: {
    fromChain: string;
    toChain: string;
    amount: string;
  }) => void;
  bridgeLoading?: boolean;
}

export function BridgeSelector({
  sourceBalance = "— USDC",
  destBalance = "— USDC",
  onFromToChange,
  onBridge,
  bridgeLoading = false,
}: BridgeSelectorProps) {
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(1);
  const [isSwapped, setIsSwapped] = useState(false);
  const [amount, setAmount] = useState("");
  const [flashFrom, setFlashFrom] = useState(false);
  const [flashTo, setFlashTo] = useState(false);

  const handleSwap = () => {
    setFromIdx((prev) => toIdx);
    setToIdx((prev) => fromIdx);
    setIsSwapped((prev) => !prev);
    setFlashFrom(true);
    setFlashTo(true);
    setTimeout(() => {
      setFlashFrom(false);
      setFlashTo(false);
    }, 400);
  };

  const fromChain = CHAINS[fromIdx];
  const toChain = CHAINS[toIdx];
  const routeLabel = `${fromChain} → ${toChain}`;

  useEffect(() => {
    onFromToChange?.(fromChain, toChain);
  }, [fromIdx, toIdx, fromChain, toChain, onFromToChange]);

  const isRouteBridgable =
    isChainBridgable(fromChain) && isChainBridgable(toChain);

  const handleBridge = () => {
    if (amount && onBridge) {
      onBridge({ fromChain, toChain, amount });
    }
  };

  return (
    <div
      className="border-[2.5px] border-[#0A0A0A] bg-white p-0"
      style={{ boxShadow: "6px 6px 0 #0A0A0A" }}
    >
      {/* Chain row: 3-column grid */}
      <div
        className="grid items-stretch"
        style={{ gridTemplateColumns: "1fr 52px 1fr" }}
      >
        {/* Column 1: FromChainBox */}
        <div
          className={`flex flex-col justify-center border-[2.5px] border-r-0 border-[#0A0A0A] px-4 py-4 transition-colors ${
            flashFrom ? "animate-chain-flash" : ""
          }`}
          style={{ backgroundColor: flashFrom ? undefined : "#FFFDE8" }}
        >
          <p className="font-mono text-[8px] font-bold uppercase tracking-wider text-[#6A6A68]">
            FROM
          </p>
          <p className="mt-0.5 font-grotesk text-[15px] font-bold text-[#0A0A0A]">
            {fromChain}
          </p>
          <div className="mt-1 flex items-center gap-1.5 font-mono text-xs text-[#6A6A68]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0A0A0A]" />
            {sourceBalance}
          </div>
        </div>

        {/* Column 2: SwapButton */}
        <button
          type="button"
          onClick={handleSwap}
          className="group flex h-full w-[52px] flex-shrink-0 items-center justify-center border-[2.5px] border-[#0A0A0A] bg-[#E4DAFF] transition-colors duration-150 hover:bg-[#0A0A0A] active:translate-x-1 active:translate-y-1 active:shadow-none"
          style={{ boxShadow: "none" }}
          aria-label="Swap source and destination chains"
        >
          <span
            className={`inline-block transition-transform duration-300 ${
              isSwapped ? "rotate-180" : ""
            } text-[#0A0A0A] group-hover:text-[#E4DAFF]`}
          >
            <ArrowIcon />
          </span>
        </button>

        {/* Column 3: ToChainBox */}
        <div
          className={`flex flex-col justify-center border-[2.5px] border-l-0 border-[#0A0A0A] px-4 py-4 transition-colors ${
            flashTo ? "animate-chain-flash" : ""
          }`}
          style={{ backgroundColor: flashTo ? undefined : "#FFFDE8" }}
        >
          <p className="font-mono text-[8px] font-bold uppercase tracking-wider text-[#6A6A68]">
            TO
          </p>
          <p className="mt-0.5 font-grotesk text-[15px] font-bold text-[#0A0A0A]">
            {toChain}
          </p>
          <div className="mt-1 flex items-center gap-1.5 font-mono text-xs text-[#6A6A68]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0A0A0A]" />
            {destBalance}
          </div>
        </div>
      </div>

      {/* Amount input */}
      <div className="border-t-[2.5px] border-[#0A0A0A] p-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="bridge-amount"
            className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#6A6A68]"
          >
            AMOUNT (USDC)
          </label>
          <input
            id="bridge-amount"
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full border-[2.5px] border-[#0A0A0A] bg-[#FFFFF8] px-4 py-3 font-grotesk text-sm text-[#0A0A0A] placeholder:text-[#6A6A68] focus:outline-none"
          />
        </div>

        {/* Summary box */}
        <div className="mt-4 border-[2.5px] border-[#0A0A0A] bg-white p-3">
          <div className="flex items-center justify-between font-mono text-xs text-[#0A0A0A]">
            <span>Route</span>
            <span className="font-bold">{routeLabel}</span>
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-xs text-[#0A0A0A]">
            <span>Bridge</span>
            <span className="inline-block border border-[#0A0A0A] px-2 py-0.5 font-bold">
              Circle CCTP
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-xs text-[#0A0A0A]">
            <span>Est. Time</span>
            <span>~20 sec</span>
          </div>
        </div>

        {/* Bridge button */}
        <button
          type="button"
          onClick={handleBridge}
          disabled={!amount || bridgeLoading || !isRouteBridgable}
          className="mt-4 w-full border-[2.5px] border-[#0A0A0A] bg-[#E8000D] px-4 py-3 font-grotesk text-sm font-bold uppercase tracking-wider text-white shadow-[4px_4px_0_#0A0A0A] transition-all duration-75 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#0A0A0A] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:pointer-events-none disabled:opacity-50"
        >
          {bridgeLoading ? "Bridging..." : "Bridge USDC →"}
        </button>

        {!isRouteBridgable && (
          <p className="mt-3 font-mono text-[10px] text-[#6A6A68]">
            Bridge only supports Base Sepolia ↔ Arc Testnet.
          </p>
        )}
      </div>
    </div>
  );
}
