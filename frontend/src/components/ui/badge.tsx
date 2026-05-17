import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const variantClasses = {
  default: "border border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
  muted: "border border-white/10 bg-white/6 text-slate-300",
  danger: "border border-rose-300/25 bg-rose-400/10 text-rose-100"
};

type BadgeVariant = keyof typeof variantClasses;

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md px-3 py-1 text-xs font-medium uppercase",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
