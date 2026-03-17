"use client";

import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export function Card({
  hoverable = true,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "relative border-2 border-brand-black bg-brand-cream shadow-brutal",
        hoverable && [
          "transition-all duration-100",
          "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal-lg",
        ],
        className
      )}
      {...props}
    >
      <div className="absolute right-0 top-0 h-3.5 w-3.5 bg-brand-yellow" />
      {children}
    </div>
  );
}
