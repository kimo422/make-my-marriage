"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Chip } from "@/components/ui/chip";
import { api } from "@/lib/api-client";
import { formatEventDay, formatTime } from "@/lib/dates";
import { EVENT_TYPE_LABELS } from "@/modules/events/schema";
import type { EventDto, EventImpactDto } from "@/modules/events/types";

interface Props {
  weddingId: string;
  timezone: string;
  events: EventDto[];
  canEdit: boolean;
}

function plural(n: number, word: string) {
  return `${String(n)} ${word}${n === 1 ? "" : "s"}`;
}

export function EventList({ weddingId, timezone, events, canEdit }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/weddings/${weddingId}/events`;

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await work();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function moveBy(index: number, delta: number) {
    const ids = events.map((e) => e.id);
    const [moved] = ids.splice(index, 1);
    if (!moved) return;
    ids.splice(index + delta, 0, moved);
    void run(() => api("POST", `${base}/reorder`, { ids }));
  }

  function remove(event: EventDto) {
    void run(async () => {
      const impact = await api<EventImpactDto>("GET", `${base}/${event.id}/impact`);
      const effects = [
        impact.tasksUnlinked
          ? `${plural(impact.tasksUnlinked, "task")} will no longer be linked to it`
          : null,
        impact.rsvpsRemoved ? `${plural(impact.rsvpsRemoved, "RSVP")} will be removed` : null,
        impact.photosMoved
          ? `${plural(impact.photosMoved, "photo")} will move to the General album`
          : null,
      ].filter(Boolean);
      const message = `Delete ${event.name}?${effects.length ? `\n\n${effects.join("\n")}` : ""}`;
      if (window.confirm(message)) await api("DELETE", `${base}/${event.id}`);
    });
  }

  if (events.length === 0) {
    return (
      <div className="border-hairline rounded-card border bg-white p-6 text-center">
        <p className="font-serif text-xl">No events yet</p>
        <p className="text-ink-muted mt-1">
          {canEdit
            ? "Add the haldi, mehendi, sangeet and the rest."
            : "The couple hasn't added any yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
      <ol className="space-y-3">
        {events.map((event, i) => (
          <li key={event.id} className="border-hairline rounded-card border bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-emerald text-xs font-semibold tracking-[0.15em] uppercase">
                  {formatEventDay(event.startAt, timezone)}
                </p>
                <h2 className="mt-1 font-serif text-2xl leading-tight">{event.name}</h2>
                <p className="text-ink-muted mt-1">
                  {formatTime(event.startAt, timezone)} – {formatTime(event.endAt, timezone)}
                  {event.venue.name ? ` · ${event.venue.name}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Chip>{EVENT_TYPE_LABELS[event.type]}</Chip>
                {!event.isPublic ? <Chip tone="blush">Private</Chip> : null}
              </div>
            </div>
            {event.venue.address || event.dressCode || event.venue.mapUrl ? (
              <dl className="text-ink-muted mt-3 space-y-1 text-sm">
                {event.venue.address ? <dd>{event.venue.address}</dd> : null}
                {event.dressCode ? <dd>Dress code: {event.dressCode}</dd> : null}
                {event.venue.mapUrl ? (
                  <dd>
                    <a
                      href={event.venue.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald font-medium underline underline-offset-2"
                    >
                      Open in Maps
                    </a>
                  </dd>
                ) : null}
              </dl>
            ) : null}
            {canEdit ? (
              <div className="border-hairline mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
                <Link
                  href={`/weddings/${weddingId}/events/${event.id}`}
                  className="hover:bg-stone rounded-full px-3 py-2 text-sm font-medium"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  disabled={busy || i === 0}
                  onClick={() => {
                    moveBy(i, -1);
                  }}
                  aria-label={`Move ${event.name} up`}
                  className="hover:bg-stone rounded-full px-3 py-2 text-sm disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={busy || i === events.length - 1}
                  onClick={() => {
                    moveBy(i, 1);
                  }}
                  aria-label={`Move ${event.name} down`}
                  className="hover:bg-stone rounded-full px-3 py-2 text-sm disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    remove(event);
                  }}
                  className="text-ink-muted hover:bg-stone hover:text-ink ml-auto rounded-full px-3 py-2 text-sm"
                >
                  Delete
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
