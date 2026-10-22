"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormAlert } from "@/components/ui/form-alert";
import { api } from "@/lib/api-client";
import type { HouseholdDto } from "@/modules/guests/types";

interface Props {
  weddingId: string;
  household: HouseholdDto;
  events: { id: string; name: string; when: string }[];
  canEdit: boolean;
}

/** Each invited event's answer; the team can fill one in for a family who replied by phone. */
export function RsvpAnswers({ weddingId, household, events, canEdit }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const invited = events.filter((e) => household.invitedEventIds.includes(e.id));
  const base = `/api/weddings/${weddingId}/households/${household.id}/rsvps`;

  async function save(eventId: string, attending: boolean, headcount: number | null) {
    setError(null);
    setBusy(eventId);
    try {
      if (headcount === null) await api("DELETE", `${base}/${eventId}`);
      else await api("POST", base, { eventId, attending, headcount });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the answer.");
    } finally {
      setBusy(null);
    }
  }

  if (invited.length === 0) {
    return <p className="text-ink-muted">Not invited to any event yet.</p>;
  }
  return (
    <div className="space-y-3">
      {error ? <FormAlert>{error}</FormAlert> : null}
      <ul className="divide-hairline divide-y">
        {invited.map((ev) => {
          const answer = household.rsvps.find((r) => r.eventId === ev.id);
          const value = !answer ? "" : answer.attending ? String(answer.headcount) : "0";
          return (
            <li key={ev.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium">{ev.name}</p>
                <p className="text-ink-muted text-sm">
                  {ev.when}
                  {answer
                    ? ` · ${answer.source === "guest" ? "answered by the family" : "entered by the team"}`
                    : ""}
                </p>
              </div>
              {canEdit ? (
                <select
                  aria-label={`Answer for ${ev.name}`}
                  value={value}
                  disabled={busy === ev.id}
                  className="border-hairline bg-field rounded-field h-11 border px-3"
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") void save(ev.id, false, null);
                    else if (v === "0") void save(ev.id, false, 0);
                    else void save(ev.id, true, Number(v));
                  }}
                >
                  <option value="">Waiting</option>
                  <option value="0">Not coming</option>
                  {Array.from({ length: household.maxHeadcount }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      {n} coming
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-sm font-medium">
                  {!answer
                    ? "Waiting"
                    : answer.attending
                      ? `${String(answer.headcount)} coming`
                      : "Not coming"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
