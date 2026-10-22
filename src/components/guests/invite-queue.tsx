"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { HouseholdDto, InviteMessageDto } from "@/modules/guests/types";

type Tab = "invite" | "reminder";

interface Props {
  weddingId: string;
  households: HouseholdDto[];
}

/**
 * Work down the list: tap WhatsApp, send it there, come back and tick it off.
 * "To remind" holds families who got the invite but haven't answered.
 */
export function InviteQueue({ weddingId, households }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("invite");
  const [waiting, setWaiting] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const ready = households.filter((h) => h.invitedEventIds.length > 0);
  const lists: Record<Tab, HouseholdDto[]> = {
    invite: ready.filter((h) => h.message.state === "not_sent"),
    reminder: ready.filter((h) => h.message.state === "sent" || h.message.state === "opened"),
  };
  const shown = lists[tab].filter((h) => !done.has(h.id));

  function open(h: HouseholdDto) {
    setError(null);
    const tabWindow = window.open("about:blank", "_blank");
    api<InviteMessageDto>("GET", `/api/weddings/${weddingId}/households/${h.id}/invite?kind=${tab}`)
      .then((msg) => {
        if (tabWindow) tabWindow.location.href = msg.whatsappUrl;
        else window.location.href = msg.whatsappUrl;
        setWaiting(h.id);
      })
      .catch((e: unknown) => {
        tabWindow?.close();
        setError(e instanceof Error ? e.message : "Couldn't prepare the message.");
      });
  }

  function confirmSent(h: HouseholdDto) {
    api("POST", `/api/weddings/${weddingId}/households/${h.id}/message/mark-sent`, { kind: tab })
      .then(() => {
        setDone((s) => new Set(s).add(h.id));
        setWaiting(null);
        router.refresh();
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Couldn't save that.");
      });
  }

  const noEvents = households.length - ready.length;

  return (
    <div className="space-y-4">
      <div className="bg-stone inline-flex rounded-full p-1" role="tablist">
        {(["invite", "reminder"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={cn(
              "h-9 rounded-full px-4 text-sm font-medium",
              tab === t ? "text-ink bg-white shadow-sm" : "text-ink-muted",
            )}
            onClick={() => {
              setTab(t);
              setWaiting(null);
            }}
          >
            {t === "invite" ? "To invite" : "To remind"} (
            {lists[t].filter((h) => !done.has(h.id)).length})
          </button>
        ))}
      </div>
      {error ? <FormAlert>{error}</FormAlert> : null}
      {noEvents > 0 ? (
        <p className="text-ink-muted text-sm">
          {noEvents} {noEvents === 1 ? "family isn't" : "families aren't"} invited to any event yet,
          so they&apos;re not listed.
        </p>
      ) : null}
      {shown.length === 0 ? (
        <div className="border-hairline rounded-card border border-dashed p-8 text-center">
          <p className="font-serif text-xl">
            {tab === "invite" ? "Everyone's invited" : "No one to remind"}
          </p>
          <p className="text-ink-muted mt-2">
            {tab === "invite"
              ? "Every family on your list has had the invite."
              : "Families appear here after their invite is sent, until they answer."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((h) => {
            const primary = h.guests.find((g) => g.id === h.primaryGuestId);
            return (
              <li key={h.id} className="border-hairline rounded-card border bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/weddings/${weddingId}/guests/${h.id}`}
                      className="font-medium hover:underline"
                    >
                      {h.name}
                    </Link>
                    <p className="text-ink-muted text-sm">
                      {primary?.phone
                        ? `To ${primary.name}`
                        : "No phone number: you'll pick the contact in WhatsApp"}
                      {tab === "reminder" && h.message.reminderCount
                        ? ` · reminded ${String(h.message.reminderCount)}×`
                        : ""}
                    </p>
                  </div>
                  {waiting === h.id ? (
                    <div className="flex gap-2">
                      <Button
                        className="h-10 w-auto px-4 text-sm"
                        onClick={() => {
                          confirmSent(h);
                        }}
                      >
                        Sent ✓
                      </Button>
                      <Button
                        variant="secondary"
                        className="h-10 w-auto px-4 text-sm"
                        onClick={() => {
                          setWaiting(null);
                        }}
                      >
                        Not yet
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="h-10 w-auto px-4 text-sm"
                      onClick={() => {
                        open(h);
                      }}
                    >
                      Open WhatsApp
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
