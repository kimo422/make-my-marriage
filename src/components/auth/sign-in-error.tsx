"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

/**
 * Failed-sign-in banner, shown when the URL carries `?error=…`.
 * Phase 1 sets that after a rejected attempt; until then `/sign-in?error=1` previews it.
 */
export function SignInError() {
  const params = useSearchParams();
  if (!params.has("error")) return null;

  return (
    <div
      role="alert"
      className="rounded-card border-hairline bg-stone/60 flex gap-3 border p-4 text-sm"
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
        <path d="M12 7.5v5.5M12 16.5v.01" stroke="currentColor" strokeWidth="1.75" />
      </svg>
      <p>
        That email and password don&apos;t match. Try again or{" "}
        <Link href="/forgot-password" className="underline underline-offset-2">
          reset your password
        </Link>
        .
      </p>
    </div>
  );
}
