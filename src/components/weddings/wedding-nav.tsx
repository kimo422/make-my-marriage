"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

/** Section tabs inside a wedding. Scrolls sideways on narrow phones; more sections arrive each phase. */
export function WeddingNav({ weddingId, canEdit }: { weddingId: string; canEdit: boolean }) {
  const pathname = usePathname();
  const base = `/weddings/${weddingId}`;
  const items = [
    { href: base, label: "Home" },
    { href: `${base}/events`, label: "Events" },
    { href: `${base}/guests`, label: "Guests" },
    { href: `${base}/rsvps`, label: "RSVPs" },
    { href: `${base}/tasks`, label: "Tasks" },
    { href: `${base}/members`, label: "Members" },
    ...(canEdit ? [{ href: `${base}/settings`, label: "Settings" }] : []),
  ];
  return (
    <nav
      aria-label="Wedding sections"
      className="-mx-4 [scrollbar-width:none] overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex gap-1">
        {items.map((item) => {
          const active = item.href === base ? pathname === base : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center rounded-full px-4 text-sm font-medium whitespace-nowrap",
                  active ? "bg-emerald text-ivory" : "text-ink-muted hover:bg-stone hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
