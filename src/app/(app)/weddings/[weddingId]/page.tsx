import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { FormFallback } from "@/components/auth/form-fallback";
import { Avatar } from "@/components/ui/avatar";
import { ArchCard } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { daysUntil, formatEventDay, formatLongDate, formatTime } from "@/lib/dates";
import { listWeddingActivity } from "@/modules/activity";
import { listWeddingEvents } from "@/modules/events";
import { can, listMembers, ROLE_LABELS, SIDE_LABELS } from "@/modules/members";
import { listWeddingTasks } from "@/modules/tasks";
import { getSummary } from "@/modules/weddings";

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
  const ctx = await loadWedding(weddingId, `/weddings/${weddingId}`);
  const { wedding, membership } = ctx;
  const [members, activity, events, summary, myTasks] = await Promise.all([
    listMembers(wedding.id),
    listWeddingActivity(wedding.id, { limit: 6 }),
    listWeddingEvents(wedding.id),
    getSummary(ctx),
    listWeddingTasks(ctx, { assigneeId: "me" }),
  ]);
  const days = daysUntil(wedding.primaryDate, wedding.timezone);
  const base = `/weddings/${wedding.id}`;
  const { todo, in_progress, done, overdue } = summary.tasks;
  const total = todo + in_progress + done;
  const myOpen = myTasks.filter((t) => t.status !== "done").slice(0, 4);

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
          <h2 className="font-serif text-xl">Events</h2>
          <Link href={`${base}/events`} className="text-emerald text-sm font-medium">
            {events.length
              ? "All events →"
              : can(membership.role, "events.edit")
                ? "Add events →"
                : ""}
          </Link>
        </div>
        {events.length === 0 ? (
          <p className="text-ink-muted mt-3">No events yet.</p>
        ) : (
          <ol className="border-hairline mt-4 space-y-4 border-l pl-5">
            {events.map((e) => (
              <li key={e.id} className="relative">
                <span
                  className="bg-emerald absolute top-2 -left-[1.6rem] size-2.5 rounded-full"
                  aria-hidden="true"
                />
                <p className="font-medium">{e.name}</p>
                <p className="text-ink-muted text-sm">
                  {formatEventDay(e.startAt, wedding.timezone)} ·{" "}
                  {formatTime(e.startAt, wedding.timezone)}
                  {e.venue.name ? ` · ${e.venue.name}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="border-hairline rounded-card border bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-xl">RSVPs</h2>
          <Link href={`${base}/rsvps`} className="text-emerald text-sm font-medium">
            {summary.rsvps.length ? "All answers →" : "Add guests →"}
          </Link>
        </div>
        {summary.rsvps.length === 0 ? (
          <p className="text-ink-muted mt-3">
            No one is invited yet.{" "}
            {can(membership.role, "guests.edit") ? (
              <Link
                href={`${base}/guests/import`}
                className="text-emerald underline underline-offset-2"
              >
                Import your guest list
              </Link>
            ) : null}
          </p>
        ) : (
          <ul className="divide-hairline mt-2 divide-y">
            {events
              .filter((e) => summary.rsvps.some((r) => r.eventId === e.id))
              .map((e) => {
                const r = summary.rsvps.find((x) => x.eventId === e.id);
                if (!r) return null;
                return (
                  <li key={e.id} className="flex items-baseline justify-between gap-4 py-3">
                    <span className="min-w-0 truncate font-medium">{e.name}</span>
                    <span className="text-ink-muted shrink-0 text-sm">
                      <span className="text-ink font-semibold">{r.attendingHeadcount}</span> coming
                      · {r.pendingHouseholds} waiting
                    </span>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <section className="border-hairline rounded-card border bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-xl">Tasks</h2>
          <Link href={`${base}/tasks`} className="text-emerald text-sm font-medium">
            Open the board →
          </Link>
        </div>
        {total === 0 ? (
          <p className="text-ink-muted mt-3">
            No tasks yet.{" "}
            {can(membership.role, "tasks.edit") ? (
              <Link
                href={`${base}/tasks/checklists`}
                className="text-emerald underline underline-offset-2"
              >
                Start from a checklist
              </Link>
            ) : null}
          </p>
        ) : (
          <>
            <p className="mt-3">
              <span className="font-serif text-3xl">{done}</span>
              <span className="text-ink-muted"> of {total} done</span>
              {overdue ? (
                <Link
                  href={`${base}/tasks?overdue=true`}
                  className="text-danger ml-3 text-sm font-semibold"
                >
                  {overdue} overdue
                </Link>
              ) : null}
            </p>
            <div
              className="bg-stone mt-3 h-2 overflow-hidden rounded-full"
              role="progressbar"
              aria-label="Tasks done"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={done}
            >
              <div
                className="bg-emerald h-full rounded-full"
                style={{ width: `${String(Math.round((done / total) * 100))}%` }}
              />
            </div>
            {myOpen.length ? (
              <div className="mt-5">
                <h3 className="text-sm font-semibold">Your tasks</h3>
                <ul className="divide-hairline mt-1 divide-y">
                  {myOpen.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`${base}/tasks/${t.id}`}
                        className="flex items-baseline justify-between gap-3 py-2.5 hover:underline"
                      >
                        <span className="min-w-0 truncate">{t.title}</span>
                        {t.dueAt ? (
                          <span
                            className={
                              t.overdue
                                ? "text-danger shrink-0 text-sm font-semibold"
                                : "text-ink-muted shrink-0 text-sm"
                            }
                          >
                            {formatLongDate(t.dueAt)}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </section>

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
    </div>
  );
}
