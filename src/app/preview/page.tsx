import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Design preview" };

// Temporary index of the screens built from the Stitch designs, until the
// flows are wired up and linked from each other.
const screens = [
  { href: "/", label: "Homepage" },
  { href: "/sign-up", label: "Sign up" },
  { href: "/sign-in", label: "Sign in" },
  { href: "/forgot-password", label: "Forgot password" },
  { href: "/forgot-password/sent", label: "Reset link sent" },
  { href: "/reset-password", label: "Choose a new password" },
  { href: "/weddings/new", label: "Create your wedding" },
];

export default function PreviewPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-6 px-4 py-10">
      <Logo />
      <div>
        <h1 className="font-serif text-4xl leading-tight tracking-tight">Design preview</h1>
        <p className="text-ink-muted mt-3">
          Screens built from the Stitch designs. Forms are not connected yet.
        </p>
      </div>
      <ul className="divide-hairline rounded-card border-hairline divide-y border bg-white">
        {screens.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="hover:bg-stone/60 flex items-center justify-between px-5 py-4"
            >
              <span>{s.label}</span>
              <span className="text-ink-muted text-sm">{s.href} →</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
