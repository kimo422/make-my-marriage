import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Quiet banner for form-level messages: a neutral stone card, never a red block. */
export function FormAlert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-card flex gap-3 border p-4 text-sm",
        tone === "error"
          ? "border-hairline bg-stone/60"
          : "border-emerald/20 bg-emerald-soft text-emerald",
      )}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="mt-0.5 shrink-0"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        {tone === "error" ? (
          <path d="M12 7.5v5.5M12 16.5v.01" stroke="currentColor" strokeWidth="1.75" />
        ) : (
          <path d="m8 12.5 2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="1.75" />
        )}
      </svg>
      <div>{children}</div>
    </div>
  );
}
