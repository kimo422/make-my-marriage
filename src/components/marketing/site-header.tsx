import Link from "next/link";

import { Logo } from "@/components/ui/logo";

const nav = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#families", label: "For families" },
  { href: "#privacy", label: "Privacy" },
];

export function SiteHeader() {
  return (
    <header className="border-hairline bg-ivory/90 sticky top-0 z-20 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-8">
        <Logo compact />
        <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className="text-ink-muted hover:text-ink">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-4">
          <Link
            href="/sign-in"
            className="text-ink-muted hover:text-ink px-2 py-2 text-[0.9375rem] whitespace-nowrap sm:text-base"
          >
            Log in
          </Link>
          <Link
            href="/sign-up"
            className="bg-emerald text-ivory hover:bg-emerald-hover inline-flex h-10 items-center rounded-full px-4 text-[0.9375rem] font-medium whitespace-nowrap sm:px-5 sm:text-base"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
