import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { FormFallback } from "@/components/auth/form-fallback";
import { Avatar } from "@/components/ui/avatar";
import { ArchCard } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { daysUntil, formatLongDate } from "@/lib/dates";
import { listWeddingActivity } from "@/modules/activity";
import { can, listMembers, ROLE_LABELS, SIDE_LABELS } from "@/modules/members";

import { loadWedding } from "@/app/(app)/weddings/[weddingId]/load";

export const metadata: Metadata = { title: "Wedding home" };

export default function WeddingHomePage({ params }: PageProps<"/weddings/[weddingId]">) {
  return (
    <Suspense fallback={<FormFallback fields={3} />}>
      <WeddingHome params={params} />
    </Suspense>
  );
}

function countdownText(days: number): string {
  if (days > 1) return `${String(days)} days to go`;
  if (days === 1) return "Tomorrow";
  if (days === 0) return "Today";
  return "Married!";
}

const timeFormat = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

async function WeddingHome({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { wedding, membership } = await loadWedding(weddingId, `/weddings/${weddingId}`);
  const [members, activity] = await Promise.all([
    listMembers(wedding.id),
    listWeddingActivity(wedding.id, { limit: 6 }),
  ]);
  const days = daysUntil(wedding.primaryDate, wedding.timezone);

  return (
    <div className="space-y-6">
      <ArchCard className="text-center">
        <p className="text-emerald text-xs font-semibold tracking-[0.2em] uppercase">
          {formatLongDate(wedding.primaryDate)} · {wedding.city}
        </p>
        <p className="mt-3 font-serif text-5xl tracking-tight">{countdownText(days)}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Chip tone="blush">You: {ROLE_LABELS[membership.role]}</Chip>
          {membership.side !== "both" ? <Chip>{SIDE_LABELS[membership.side]}</Chip> : null}
          {wedding.tradition ? <Chip>{wedding.tradition}</Chip> : null}
        </div>
      </ArchCard>

      <section className="border-hairline rounded-card border bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-xl">Planning team</h2>
          <Link
            href={`/weddings/${wedding.id}/members`}
            className="text-emerald text-sm font-medium"
          >
            {can(membership.role, "members.manage") ? "Invite family →" : "See everyone →"}
          </Link>
        </div>
        <ul className="mt-4 flex flex-wrap gap-2" aria-label={`${String(members.length)} members`}>
          {members.slice(0, 8).map((m) => (
            <li key={m.userId} title={`${m.name} · ${ROLE_LABELS[m.role]}`}>
              <Avatar name={m.name} />
              <span className="sr-only">
                {m.name}, {ROLE_LABELS[m.role]}
              </span>
            </li>
          ))}
          {members.length > 8 ? (
            <li className="bg-stone text-ink-muted flex size-10 items-center justify-center rounded-full text-sm">
              +{members.length - 8}
            </li>
          ) : null}
        </ul>
      </section>

      <section className="border-hairline rounded-card border bg-white p-6">
        <h2 className="font-serif text-xl">Recent activity</h2>
        {activity.items.length === 0 ? (
          <p className="text-ink-muted mt-3">Nothing yet.</p>
        ) : (
          <ul className="divide-hairline mt-2 divide-y">
            {activity.items.map((a) => (
              <li key={a.id} className="flex items-baseline justify-between gap-4 py-3">
                <span>{a.summary}</span>
                <time dateTime={a.at} className="text-ink-muted shrink-0 text-sm">
                  {timeFormat.format(new Date(a.at))}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-ink-muted text-center text-sm">
        Events, tasks and guests arrive in the next phases.
      </p>
    </div>
  );
}
