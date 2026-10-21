import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

const tones = {
  stone: "bg-stone text-ink",
  blush: "bg-blush text-ink",
  emerald: "bg-emerald text-ivory",
  soft: "bg-emerald-soft text-emerald",
} as const;

/** Status pill from the design system (label-sm, full radius). */
export function Chip({
  children,
  tone = "stone",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
