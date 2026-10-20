import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** White card with the signature arch top (rounded top corners, grounded bottom). */
export function ArchCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-t-arch rounded-b-card border-hairline border bg-white p-6 sm:p-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
