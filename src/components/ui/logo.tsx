import Link from "next/link";

import { cn } from "@/lib/cn";

/** Arch mark + serif wordmark. `compact` shrinks the wordmark on phones, for tight headers. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link
      href="/"
      className={cn("text-ink inline-flex min-w-0 items-center gap-2", className)}
      aria-label="Make My Marriage home"
    >
      <svg
        width="22"
        height="26"
        viewBox="0 0 22 26"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <path
          d="M2 25V11a9 9 0 0 1 18 0v14"
          stroke="currentColor"
          strokeWidth="1.75"
          className="text-emerald"
        />
        <path d="M7 25V12a4 4 0 0 1 8 0v13" stroke="currentColor" strokeWidth="1.25" />
      </svg>
      <span
        className={cn(
          "font-serif leading-none tracking-tight whitespace-nowrap",
          compact ? "text-lg sm:text-[1.375rem]" : "text-[1.375rem]",
        )}
      >
        Make My Marriage
      </span>
    </Link>
  );
}
