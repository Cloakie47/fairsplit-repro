"use client";

import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type BadgeVariant = "red" | "green" | "mono";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  red: "bg-brand-red text-white",
  green: "bg-brand-green text-white",
  mono: "bg-white text-brand-black",
};

export function Badge({
  variant = "red",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center border-2 border-brand-black px-2 py-0.5",
        "font-mono text-label font-bold uppercase",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
