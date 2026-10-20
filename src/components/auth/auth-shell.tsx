import type { ReactNode } from "react";

import { ArchCard } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

/** Centered phone-width column used by every sign-in / sign-up screen. */
export function AuthShell({
  title,
  subtitle,
  children,
  below,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Content under the card: banners, legal microcopy. */
  below?: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col justify-center px-4 py-10">
      <Logo className="mb-8 self-center" />
      <ArchCard>
        <h1 className="font-serif text-[2rem] leading-tight tracking-tight">{title}</h1>
        {subtitle ? <p className="text-ink-muted mt-2">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </ArchCard>
      {below ? <div className="mt-5 space-y-4">{below}</div> : null}
    </main>
  );
}

export function LegalNote({ verb = "continuing" }: { verb?: string }) {
  return (
    <p className="text-ink-muted text-center text-sm">
      By {verb} you agree to our{" "}
      <a href="#" className="hover:text-ink underline underline-offset-2">
        Terms
      </a>{" "}
      and{" "}
      <a href="#" className="hover:text-ink underline underline-offset-2">
        Privacy Policy
      </a>
      .
    </p>
  );
}
