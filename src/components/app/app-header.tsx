import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/ui/logo";

/** Top bar for signed-in pages: logo, optional context (wedding switcher), account link. */
export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="border-hairline bg-ivory/90 sticky top-0 z-20 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4">
        <Logo compact />
        <div className="flex min-w-0 items-center gap-1 sm:gap-3">
          {children}
          <Link
            href="/account"
            className="text-ink-muted hover:text-ink hover:bg-stone rounded-full px-3 py-2 text-sm whitespace-nowrap"
          >
            Account
          </Link>
        </div>
      </div>
    </header>
  );
}
