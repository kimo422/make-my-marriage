import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { loadWedding } from "@/app/(app)/weddings/[weddingId]/load";
import { FormFallback } from "@/components/auth/form-fallback";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";
import { formatEventDay, formatLongDate } from "@/lib/dates";
import { listWeddingEvents } from "@/modules/events";
import { eventRsvps, HOUSEHOLD_SIDE_LABELS, rsvpClosed, rsvpSummary } from "@/modules/guests";
import { can, SIDE_LABELS } from "@/modules/members";

export const metadata: Metadata = { title: "RSVPs" };

export default function RsvpsPage({
  params,
  searchParams,
}: PageProps<"/weddings/[weddingId]/rsvps">) {
  return (
    <Suspense fallback={<FormFallback fields={4} />}>
      <Rsvps params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Rsvps({
  params,
  searchParams,
}: {
  params: Promise<{ weddingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { weddingId } = await params;
  const { eventId: rawEventId } = await searchParams;
  const ctx = await loadWedding(weddingId, `/weddings/${weddingId}/rsvps`, "rsvps.view");
  const { wedding, membership } = ctx;
  const [events, summary] = await Promise.all([listWeddingEvents(wedding.id), rsvpSummary(ctx)]);
  const byEvent = new Map(summary.map((s) => [s.eventId, s]));
  const selected = events.find((e) => e.id === rawEventId) ?? events.find((e) => byEvent.has(e.id));
  const rows = selected ? await eventRsvps(ctx, selected.id) : [];
  const base = `/weddings/${wedding.id}/rsvps`;
  const exportHref = `/api/weddings/${wedding.id}/rsvps/export.csv`;
  const oneSide = membership.role === "organizer" && membership.side !== "both";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[2rem] leading-tight tracking-tight">RSVPs</h1>
          <p className="text-ink-muted mt-1">
            {oneSide ? `${SIDE_LABELS[membership.side]} only. ` : ""}
            {wedding.rsvpDeadline
              ? rsvpClosed(wedding)
                ? `RSVPs closed on ${formatLongDate(wedding.rsvpDeadline)}.`
                : `Families can reply until ${formatLongDate(wedding.rsvpDeadline)}.`
              : "No reply-by date set. Add one in Settings."}
          </p>
        </div>
        {can(membership.role, "rsvps.export") && summary.length ? (
          <a
            href={exportHref}
            className="border-hairline bg-field text-ink hover:bg-stone inline-flex h-11 shrink-0 items-center rounded-full border px-5 font-medium"
          >
            Download for caterer
          </a>
        ) : null}
      </div>

      {summary.length === 0 ? (
        <div className="border-hairline rounded-card border border-dashed p-8 text-center">
          <p className="font-serif text-xl">No invitations yet</p>
          <p className="text-ink-muted mt-2">
            Add families and choose their events; their answers show up here.
          </p>
          {can(membership.role, "guests.edit") ? (
            <Link
              href={`/weddings/${wedding.id}/guests`}
              className="text-emerald mt-3 inline-block font-medium"
            >
              Go to guests →
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2">
            {events
              .filter((e) => byEvent.has(e.id))
              .map((e) => {
                const s = byEvent.get(e.id);
                if (!s) return null;
                const answered = s.attendingHouseholds + s.declinedHouseholds;
                return (
                  <li key={e.id}>
                    <Link
                      href={`${base}?eventId=${e.id}`}
                      aria-current={selected?.id === e.id ? "true" : undefined}
                      className={cn(
                        "rounded-card block border bg-white p-5 transition",
                        selected?.id === e.id
                          ? "border-emerald"
                          : "border-hairline hover:border-emerald/40",
                      )}
                    >
                      <p className="font-medium">{e.name}</p>
                      <p className="text-ink-muted text-sm">
                        {formatEventDay(e.startAt, wedding.timezone)}
                      </p>
                      <p className="mt-3">
                        <span className="font-serif text-3xl">{s.attendingHeadcount}</span>
                        <span className="text-ink-muted"> coming</span>
                      </p>
                      <div
                        className="bg-stone mt-3 h-2 overflow-hidden rounded-full"
                        role="progressbar"
                        aria-label={`${e.name}: families answered`}
                        aria-valuemin={0}
                        aria-valuemax={s.invitedHouseholds}
                        aria-valuenow={answered}
                      >
                        <div
                          className="bg-emerald h-full rounded-full"
                          style={{
                            width: `${String(Math.round((answered / Math.max(1, s.invitedHouseholds)) * 100))}%`,
                          }}
                        />
                      </div>
                      <p className="text-ink-muted mt-2 text-sm">
                        {s.attendingHouseholds} yes · {s.declinedHouseholds} no ·{" "}
                        {s.pendingHouseholds} waiting · {s.invitedHouseholds} families invited
                      </p>
                    </Link>
                  </li>
                );
              })}
          </ul>

          {selected ? (
            <section className="border-hairline rounded-card border bg-white p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-serif text-xl">{selected.name}</h2>
                {can(membership.role, "rsvps.export") ? (
                  <a
                    href={`${exportHref}?eventId=${selected.id}`}
                    className="text-emerald text-sm font-medium"
                  >
                    Download this event
                  </a>
                ) : null}
              </div>
              <ul className="divide-hairline mt-3 divide-y">
                {rows.map((r) => (
                  <li key={r.householdId} className="flex items-center justify-between gap-3 py-3">
                    <Link
                      href={`/weddings/${wedding.id}/guests/${r.householdId}`}
                      className="min-w-0 hover:underline"
                    >
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="text-ink-muted block text-sm">
                        {HOUSEHOLD_SIDE_LABELS[r.side]}
                        {r.group ? ` · ${r.group}` : ""} · up to {r.maxHeadcount}
                      </span>
                    </Link>
                    {!r.answer ? (
                      <Chip>Waiting</Chip>
                    ) : r.answer.attending ? (
                      <Chip tone="emerald">{r.answer.headcount} coming</Chip>
                    ) : (
                      <Chip tone="blush">Not coming</Chip>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
