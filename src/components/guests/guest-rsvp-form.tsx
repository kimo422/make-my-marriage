"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { googleCalendarUrl } from "@/lib/ics";

export interface GuestRsvpEvent {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  /** Pre-formatted in the wedding's time zone by the server. */
  when: string;
  venueName: string | null;
  venueAddress: string | null;
  mapUrl: string | null;
  dressCode: string | null;
}

interface Answer {
  attending: boolean | null;
  headcount: number;
}

interface Props {
  token: string;
  coupleNames: string;
  events: GuestRsvpEvent[];
  maxHeadcount: number;
  initial: { eventId: string; attending: boolean; headcount: number }[];
  closed: boolean;
}

export function GuestRsvpForm({
  token,
  coupleNames,
  events,
  maxHeadcount,
  initial,
  closed,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, Answer>>(() =>
    Object.fromEntries(
      events.map((e) => {
        const a = initial.find((x) => x.eventId === e.id);
        return [
          e.id,
          { attending: a?.attending ?? null, headcount: a?.attending ? a.headcount : maxHeadcount },
        ];
      }),
    ),
  );
  const [done, setDone] = useState(initial.length > 0 && initial.length >= events.length);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const path = `/api/public/rsvp/${token}`;

  // The "opened" tick for the family's invite. Sent from the page, not the
  // server render, so WhatsApp's link preview doesn't count as an open.
  useEffect(() => {
    void fetch(`${path}/opened`, { method: "POST" }).catch(() => undefined);
  }, [path]);

  function set(eventId: string, patch: Partial<Answer>) {
    setAnswers((all) => {
      const current = all[eventId] ?? { attending: null, headcount: maxHeadcount };
      return { ...all, [eventId]: { ...current, ...patch } };
    });
  }

  async function submit() {
    const list = events.flatMap((e) => {
      const a = answers[e.id];
      if (!a || a.attending === null) return [];
      return [{ eventId: e.id, attending: a.attending, headcount: a.attending ? a.headcount : 0 }];
    });
    if (list.length < events.length) {
      setError("Please answer for every function.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      await api("POST", path, { answers: list });
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send your reply. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const attending = events.filter((e) => answers[e.id]?.attending);

  if (done) {
    return (
      <div className="space-y-6">
        <div className="bg-emerald-soft rounded-card p-6 text-center">
          <p className="font-serif text-3xl">Thank you!</p>
          <p className="mt-2">
            {attending.length
              ? `${coupleNames} look forward to seeing you.`
              : `${coupleNames} will miss you, and thank you for letting them know.`}
          </p>
        </div>
        <ul className="divide-hairline divide-y">
          {events.map((e) => {
            const a = answers[e.id];
            return (
              <li key={e.id} className="flex items-baseline justify-between gap-3 py-3">
                <span className="font-medium">{e.name}</span>
                <span className="text-ink-muted text-sm">
                  {a?.attending ? `${String(a.headcount)} coming` : "Not coming"}
                </span>
              </li>
            );
          })}
        </ul>
        {attending.length ? (
          <div className="space-y-3">
            <h2 className="font-serif text-xl">Add to your calendar</h2>
            <a
              href={`${path}/calendar.ics`}
              className="bg-emerald text-ivory hover:bg-emerald-hover inline-flex h-12 w-full items-center justify-center rounded-full font-medium"
            >
              Phone or Outlook calendar
            </a>
            <ul className="space-y-2">
              {attending.map((e) => (
                <li key={e.id}>
                  <a
                    href={googleCalendarUrl({
                      uid: e.id,
                      title: `${e.name}: ${coupleNames}`,
                      startAt: e.startAt,
                      endAt: e.endAt,
                      location: [e.venueName, e.venueAddress].filter(Boolean).join(", ") || null,
                    })}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald text-sm font-medium underline underline-offset-2"
                  >
                    Add {e.name} to Google Calendar
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {!closed ? (
          <button
            type="button"
            className="text-emerald w-full py-2 text-center font-medium underline underline-offset-2"
            onClick={() => {
              setDone(false);
            }}
          >
            Change my answer
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {closed ? (
        <FormAlert>
          RSVPs have closed. Please contact the family directly to change your plans.
        </FormAlert>
      ) : null}
      {error ? <FormAlert>{error}</FormAlert> : null}
      <ul className="space-y-4">
        {events.map((e) => {
          const a = answers[e.id] ?? { attending: null, headcount: maxHeadcount };
          return (
            <li key={e.id} className="border-hairline rounded-card border bg-white p-5">
              <p className="font-serif text-xl">{e.name}</p>
              <p className="text-ink-muted mt-1 text-sm">{e.when}</p>
              {e.venueName || e.venueAddress ? (
                <p className="mt-1 text-sm">
                  {[e.venueName, e.venueAddress].filter(Boolean).join(", ")}
                  {e.mapUrl ? (
                    <>
                      {" · "}
                      <a
                        href={e.mapUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald font-medium"
                      >
                        Map
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
              {e.dressCode ? (
                <p className="text-ink-muted mt-1 text-sm">Dress code: {e.dressCode}</p>
              ) : null}

              <div
                className="mt-4 grid grid-cols-2 gap-2"
                role="group"
                aria-label={`Coming to ${e.name}?`}
              >
                {([true, false] as const).map((yes) => (
                  <button
                    key={String(yes)}
                    type="button"
                    disabled={closed}
                    aria-pressed={a.attending === yes}
                    className={cn(
                      "h-12 rounded-full border font-medium transition",
                      a.attending === yes
                        ? yes
                          ? "bg-emerald text-ivory border-emerald"
                          : "bg-stone border-ink/30"
                        : "border-hairline bg-field hover:bg-stone",
                    )}
                    onClick={() => {
                      set(e.id, { attending: yes });
                    }}
                  >
                    {yes ? "Joyfully yes" : "Sadly no"}
                  </button>
                ))}
              </div>
              {a.attending && maxHeadcount > 1 ? (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">How many of you?</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="One fewer"
                      disabled={closed || a.headcount <= 1}
                      className="border-hairline bg-field size-10 rounded-full border text-lg disabled:opacity-40"
                      onClick={() => {
                        set(e.id, { headcount: a.headcount - 1 });
                      }}
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-lg font-semibold" aria-live="polite">
                      {a.headcount}
                    </span>
                    <button
                      type="button"
                      aria-label="One more"
                      disabled={closed || a.headcount >= maxHeadcount}
                      className="border-hairline bg-field size-10 rounded-full border text-lg disabled:opacity-40"
                      onClick={() => {
                        set(e.id, { headcount: a.headcount + 1 });
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {!closed ? (
        <Button
          disabled={pending}
          onClick={() => {
            void submit();
          }}
        >
          {pending ? "Sending…" : "Send my reply"}
        </Button>
      ) : null}
    </div>
  );
}
