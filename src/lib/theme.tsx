"use client";

import { useChainId } from "wagmi";
import { SUPPORTED_CHAINS } from "./chains";

export type ChainTheme = "blue" | "orange" | "neutral";

export function useChainTheme(): ChainTheme {
  const chainId = useChainId();
  if (chainId && chainId === SUPPORTED_CHAINS.baseSepolia.id) return "blue";
  if (chainId && chainId === SUPPORTED_CHAINS.arcTestnet.id) return "orange";
  return "neutral";
}

export const CHAIN_GRADIENTS = {
  blue: "from-[#90bfff] via-[#d8e9ff] to-[#69a7ff]",
  orange: "from-[#ffbe73] via-[#ffe2bf] to-[#ff9f5c]",
  neutral: "from-stone-200 via-stone-100 to-stone-200",
} as const;

export const CHAIN_ACCENT = {
  blue: {
    bg: "bg-black",
    hover: "hover:bg-zinc-800",
    text: "text-blue-700",
    border: "border-blue-200",
    light: "bg-blue-300",
    focus: "focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-300",
  },
  orange: {
    bg: "bg-black",
    hover: "hover:bg-zinc-800",
    text: "text-orange-700",
    border: "border-orange-200",
    light: "bg-orange-300",
    focus: "focus:outline-none focus:ring-2 focus:border-orange-500 focus:ring-orange-300",
  },
  neutral: {
    bg: "bg-black",
    hover: "hover:bg-zinc-800",
    text: "text-stone-700",
    border: "border-stone-200",
    light: "bg-stone-50",
    focus: "focus:outline-none focus:ring-2 focus:border-stone-500 focus:ring-stone-300",
  },
} as const;
