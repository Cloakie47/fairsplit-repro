"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, className, id, ...props }, ref) {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="label-text text-brand-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            "w-full border-2 border-brand-black bg-brand-bg px-4 py-3",
            "font-grotesk text-body text-brand-black placeholder:text-brand-muted",
            "transition-all duration-75",
            "focus:bg-brand-yellow focus:shadow-brutal focus:-translate-x-px focus:-translate-y-px",
            "focus:outline-none",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
