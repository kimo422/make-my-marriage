import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AppHeader } from "@/components/app/app-header";
import { FormFallback } from "@/components/auth/form-fallback";
import { Chip } from "@/components/ui/chip";
import { RestoreWeddingButton } from "@/components/weddings/restore-button";
import { getCurrentUser } from "@/lib/auth/session";
import { daysUntil, formatLongDate } from "@/lib/dates";
import { ROLE_LABELS } from "@/modules/members";
import { listMyWeddings, RESTORE_WINDOW_DAYS } from "@/modules/weddings";

export const metadata: Metadata = { title: "Your weddings" };

export default function WeddingsPage({ searchParams }: PageProps<"/weddings">) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="font-serif text-[2rem] leading-tight tracking-tight">Your weddings</h1>
        <div className="mt-6">
          <Suspense fallback={<FormFallback />}>
            <WeddingList searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
    </>
  );
}

async function WeddingList({
  searchParams,
}: {
  searchParams: PageProps<"/weddings">["searchParams"];
}) {
  const user = await getCurrentUser("/weddings");
  const weddings = await listMyWeddings(user);
  const active = weddings.filter((w) => !w.deletedAt);
  const deleted = weddings.filter((w) => w.deletedAt);

  // Most families plan one wedding: skip the list unless they asked to switch.
  const { pick } = await searchParams;
  if (weddings.length === 0) redirect("/weddings/new");
  if (active.length === 1 && deleted.length === 0 && !pick)
    redirect(`/weddings/${active[0]?.id ?? ""}`);

  return (
    <div className="space-y-8">
      <ul className="space-y-3">
        {active.map((w) => {
          const days = daysUntil(w.primaryDate, w.timezone);
          return (
            <li key={w.id}>
              <Link
                href={`/weddings/${w.id}`}
                className="border-hairline rounded-card hover:bg-stone/50 flex items-center justify-between gap-4 border bg-white p-5"
              >
                <span className="min-w-0">
                  <span className="block truncate font-serif text-2xl">
                    {w.brideName} &amp; {w.groomName}
                  </span>
                  <span className="text-ink-muted mt-1 block text-sm">
                    {formatLongDate(w.primaryDate)} · {w.city}
                    {days >= 0 ? ` · ${String(days)} ${days === 1 ? "day" : "days"} to go` : ""}
                  </span>
                </span>
                <Chip tone={w.role === "owner" ? "blush" : "stone"}>{ROLE_LABELS[w.role]}</Chip>
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href="/weddings/new"
        className="border-hairline bg-field hover:bg-stone inline-flex h-12 w-full items-center justify-center rounded-full border font-medium"
      >
        Create another wedding
      </Link>

      {deleted.length > 0 ? (
        <section aria-labelledby="deleted-heading" className="space-y-3">
          <h2 id="deleted-heading" className="font-serif text-xl">
            Recently deleted
          </h2>
          <p className="text-ink-muted text-sm">
            Deleted weddings can be restored for {RESTORE_WINDOW_DAYS} days, then they&apos;re gone
            for good.
          </p>
          <ul className="space-y-3">
            {deleted.map((w) => (
              <li
                key={w.id}
                className="border-hairline rounded-card bg-stone/40 flex items-center justify-between gap-4 border p-5"
              >
                <span className="min-w-0">
                  <span className="block truncate font-serif text-xl">
                    {w.brideName} &amp; {w.groomName}
                  </span>
                  <span className="text-ink-muted block text-sm">
                    {formatLongDate(w.primaryDate)}
                  </span>
                </span>
                <RestoreWeddingButton weddingId={w.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
