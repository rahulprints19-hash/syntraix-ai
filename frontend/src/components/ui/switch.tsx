"use client";

import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onCheckedChange
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      aria-checked={checked}
      className={cn(
        "relative h-6 w-11 rounded-full border border-white/10 transition",
        checked ? "bg-cyan-300/70" : "bg-white/10"
      )}
      onClick={() => onCheckedChange(!checked)}
      role="switch"
      type="button"
    >
      <span
        className={cn(
          "absolute top-1 size-4 rounded-full bg-white transition",
          checked ? "left-6" : "left-1"
        )}
      />
    </button>
  );
}
