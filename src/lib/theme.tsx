"use client";

import { useChainId } from "wagmi";
import { SUPPORTED_CHAINS } from "./chains";

export type ChainTheme = "blue" | "orange" | "tempo" | "neutral";

export function useChainTheme(): ChainTheme {
  const chainId = useChainId();
  if (chainId && chainId === SUPPORTED_CHAINS.baseSepolia.id) return "blue";
  if (chainId && chainId === SUPPORTED_CHAINS.arcTestnet.id) return "orange";
  if (chainId && chainId === SUPPORTED_CHAINS.tempoTestnet.id) return "tempo";
  return "neutral";
}

export const CHAIN_GRADIENTS = {
  blue: "from-[#90bfff] via-[#d8e9ff] to-[#69a7ff]",
  orange: "from-[#ffbe73] via-[#ffe2bf] to-[#ff9f5c]",
  tempo: "from-[#d7dde8] via-[#f5f7fb] to-[#c4ccdb]",
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
  tempo: {
    bg: "bg-slate-900",
    hover: "hover:bg-slate-800",
    text: "text-slate-800",
    border: "border-slate-300",
    light: "bg-slate-300",
    focus: "focus:outline-none focus:ring-2 focus:border-slate-500 focus:ring-slate-300",
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
