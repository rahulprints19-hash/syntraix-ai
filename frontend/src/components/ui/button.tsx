import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const variantClasses = {
  default:
    "bg-[linear-gradient(135deg,#5eead4_0%,#38bdf8_52%,#a78bfa_100%)] text-slate-950 shadow-[0_14px_44px_rgba(59,199,255,0.28)] hover:opacity-95",
  secondary: "border border-white/12 bg-white/5 text-white hover:bg-white/10",
  ghost: "text-slate-200 hover:bg-white/8"
};

const sizeClasses = {
  default: "h-11 px-4 py-2",
  sm: "h-9 px-3 text-sm",
  lg: "h-12 px-5 text-base"
};

type ButtonVariant = keyof typeof variantClasses;
type ButtonSize = keyof typeof sizeClasses;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function buttonClassName({
  className,
  size = "default",
  variant = "default"
}: {
  className?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
} = {}): string {
  return cn(
    "inline-flex items-center justify-center rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 disabled:pointer-events-none disabled:opacity-60",
    variantClasses[variant],
    sizeClasses[size],
    className
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size = "default", type = "button", variant = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={buttonClassName({ className, size, variant })}
      type={type}
      {...props}
    />
  )
);

Button.displayName = "Button";
