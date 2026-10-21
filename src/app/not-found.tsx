import type { Metadata } from "next";
import Link from "next/link";

import { ArchCard } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Page not found" };

// Also shown for weddings you're not a member of: a stranger can't tell
// whether a wedding exists.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col justify-center px-4 py-10">
      <Logo className="mb-8 self-center" />
      <ArchCard className="space-y-4">
        <p className="text-emerald text-xs font-semibold tracking-[0.2em] uppercase">404</p>
        <h1 className="font-serif text-[2rem] leading-tight tracking-tight">
          We couldn&apos;t find that page
        </h1>
        <p className="text-ink-muted">
          The link may be wrong, or it may be a wedding you haven&apos;t been invited to yet.
        </p>
        <Link
          href="/weddings?pick=1"
          className="bg-emerald text-ivory hover:bg-emerald-hover inline-flex h-12 w-full items-center justify-center rounded-full font-medium"
        >
          Go to your weddings
        </Link>
      </ArchCard>
    </main>
  );
}
