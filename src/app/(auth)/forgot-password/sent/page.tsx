import type { Metadata } from "next";
import Link from "next/link";

import { ArchCard } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Check your email" };

export default function ResetLinkSentPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col justify-center px-4 py-10">
      <Logo className="mb-8 self-center" />
      <ArchCard>
        <div className="border-hairline bg-emerald-soft text-emerald flex size-14 items-center justify-center rounded-full border">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect
              x="3"
              y="5"
              width="18"
              height="14"
              rx="2.5"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
        <h1 className="mt-6 font-serif text-[2rem] leading-tight tracking-tight">
          Check your email
        </h1>
        <p className="text-ink-muted mt-3">
          If an account exists for that email, a reset link is on its way. It works for 1 hour.
        </p>
        <Link
          href="/sign-in"
          className="border-hairline bg-field hover:bg-stone mt-8 inline-flex h-12 w-full items-center justify-center rounded-full border font-medium"
        >
          Back to sign in
        </Link>
        <p className="border-hairline text-ink-muted mt-6 border-t pt-5 text-center">
          Didn&apos;t get it?{" "}
          <Link href="/forgot-password" className="text-emerald font-medium">
            Send again
          </Link>
        </p>
      </ArchCard>
    </main>
  );
}
