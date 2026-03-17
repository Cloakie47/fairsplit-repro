"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "yellow" | "red" | "black" | "white";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, string> = {
  yellow: "bg-brand-yellow text-brand-black",
  red: "bg-brand-red text-white",
  black: "bg-brand-black text-white",
  white: "bg-white text-brand-black",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs font-bold",
  md: "px-5 py-2.5 text-sm font-bold",
  lg: "px-8 py-3.5 text-base font-bold",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "yellow", size = "md", className, disabled, children, ...props },
    ref
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "relative border-2 border-brand-black font-grotesk uppercase tracking-wide",
          "shadow-brutal transition-all duration-75",
          "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal-lg",
          "active:translate-x-1 active:translate-y-1 active:shadow-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-black",
          "disabled:pointer-events-none disabled:opacity-50",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
