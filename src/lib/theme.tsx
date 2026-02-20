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
  blue: "from-sky-200 via-blue-100 to-indigo-200",
  orange: "from-amber-200 via-orange-100 to-rose-200",
  neutral: "from-stone-200 via-stone-100 to-stone-200",
} as const;

export const CHAIN_ACCENT = {
  blue: {
    bg: "bg-black",
    hover: "hover:bg-zinc-800",
    text: "text-sky-700",
    border: "border-sky-200",
    light: "bg-sky-50",
    focus: "focus:outline-none focus:ring-2 focus:border-sky-500 focus:ring-sky-300",
  },
  orange: {
    bg: "bg-black",
    hover: "hover:bg-zinc-800",
    text: "text-orange-700",
    border: "border-orange-200",
    light: "bg-orange-50",
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
