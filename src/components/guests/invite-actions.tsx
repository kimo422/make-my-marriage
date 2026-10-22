"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { api } from "@/lib/api-client";
import { MESSAGE_STATE_LABELS, type MessageKind } from "@/modules/guests/schema";
import type { HouseholdDto, InviteMessageDto } from "@/modules/guests/types";

const KIND_LABEL: Record<Exclude<MessageKind, "event_day">, string> = {
  invite: "Send invite on WhatsApp",
  reminder: "Send a reminder",
};

/**
 * The WhatsApp flow (API Design): open wa.me with the message ready, the person
 * taps send in WhatsApp, then confirms here so the queue moves on.
 */
export function InviteActions({
  weddingId,
  household,
}: {
  weddingId: string;
  household: HouseholdDto;
}) {
  const router = useRouter();
  const [opened, setOpened] = useState<Exclude<MessageKind, "event_day"> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const base = `/api/weddings/${weddingId}/households/${household.id}`;
  const kind = household.message.state === "not_sent" ? "invite" : "reminder";

  async function run(fn: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  // Opened synchronously from the click so phone browsers don't block the new tab.
  function openWhatsApp(k: Exclude<MessageKind, "event_day">) {
    const tab = window.open("about:blank", "_blank");
    void run(async () => {
      const msg = await api<InviteMessageDto>("GET", `${base}/invite?kind=${k}`);
      if (tab) tab.location.href = msg.whatsappUrl;
      else window.location.href = msg.whatsappUrl;
      setOpened(k);
    });
  }

  return (
    <div className="space-y-4">
      {error ? <FormAlert>{error}</FormAlert> : null}
      {message ? <FormAlert tone="success">{message}</FormAlert> : null}
      <p className="text-ink-muted text-sm">
        Status:{" "}
        <span className="text-ink font-medium">
          {MESSAGE_STATE_LABELS[household.message.state]}
        </span>
        {household.message.reminderCount
          ? ` · ${String(household.message.reminderCount)} reminder${household.message.reminderCount === 1 ? "" : "s"} sent`
          : ""}
      </p>
      {household.invitedEventIds.length === 0 ? (
        <p className="text-sm">Choose at least one event before sending the invite.</p>
      ) : opened ? (
        <div className="bg-emerald-soft rounded-card space-y-3 p-4">
          <p className="text-sm">Did you send it in WhatsApp?</p>
          <div className="flex flex-wrap gap-2">
            <Button
              className="h-11 w-auto"
              disabled={busy}
              onClick={() => {
                void run(async () => {
                  await api("POST", `${base}/message/mark-sent`, { kind: opened });
                  setOpened(null);
                  setMessage(opened === "invite" ? "Marked as invited." : "Reminder recorded.");
                  router.refresh();
                });
              }}
            >
              Yes, I sent it
            </Button>
            <Button
              variant="secondary"
              className="h-11 w-auto"
              onClick={() => {
                setOpened(null);
              }}
            >
              Not yet
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            className="h-11 w-auto"
            disabled={busy || household.message.state === "responded"}
            onClick={() => {
              openWhatsApp(kind);
            }}
          >
            {household.message.state === "responded" ? "They've replied" : KIND_LABEL[kind]}
          </Button>
          <Button
            variant="secondary"
            className="h-11 w-auto"
            disabled={busy}
            onClick={() => {
              void run(async () => {
                const msg = await api<InviteMessageDto>("GET", `${base}/invite?kind=${kind}`);
                await navigator.clipboard.writeText(msg.rsvpUrl);
                setMessage("RSVP link copied.");
              });
            }}
          >
            Copy RSVP link
          </Button>
          <Button
            variant="secondary"
            className="h-11 w-auto"
            disabled={busy}
            onClick={() => {
              if (
                !window.confirm(
                  "Make a new RSVP link? The old one will stop working for this family.",
                )
              )
                return;
              void run(async () => {
                await api("POST", `${base}/rsvp-link/regenerate`);
                setMessage("New link made. Send it to the family again.");
                router.refresh();
              });
            }}
          >
            New link
          </Button>
        </div>
      )}
    </div>
  );
}
