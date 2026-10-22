"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Chip } from "@/components/ui/chip";
import { inputClass } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { cn } from "@/lib/cn";
import {
  HOUSEHOLD_SIDE_LABELS,
  MESSAGE_STATE_LABELS,
  MESSAGE_STATES,
  type HouseholdSide,
  type MessageState,
} from "@/modules/guests/schema";
import type { HouseholdDto } from "@/modules/guests/types";

const STATE_TONE: Record<MessageState, "stone" | "blush" | "soft" | "emerald"> = {
  not_sent: "stone",
  sent: "blush",
  opened: "soft",
  responded: "emerald",
};

interface Props {
  weddingId: string;
  households: HouseholdDto[];
  events: { id: string; name: string }[];
  /** Organizers limited to one side don't need the side filter. */
  showSideFilter: boolean;
}

/** Families with search and filters, all in the browser: the whole list is already here. */
export function GuestList({ weddingId, households, events, showSideFilter }: Props) {
  const [q, setQ] = useState("");
  const [side, setSide] = useState<"" | HouseholdSide>("");
  const [state, setState] = useState<"" | MessageState>("");
  const eventName = useMemo(() => new Map(events.map((e) => [e.id, e.name])), [events]);

  const shown = households.filter((h) => {
    if (side && h.side !== side) return false;
    if (state && h.message.state !== state) return false;
    if (!q) return true;
    const needle = q.toLowerCase();
    return (
      h.name.toLowerCase().includes(needle) ||
      h.guests.some((g) => g.name.toLowerCase().includes(needle)) ||
      (h.group ?? "").toLowerCase().includes(needle)
    );
  });
  const guestCount = shown.reduce((n, h) => n + h.guests.length, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="sr-only" htmlFor="guest-search">
          Search guests
        </label>
        <input
          id="guest-search"
          type="search"
          value={q}
          placeholder="Search families, guests or groups"
          className={inputClass}
          onChange={(e) => {
            setQ(e.target.value);
          }}
        />
        {showSideFilter ? (
          <SelectField
            label="Side"
            hideLabel
            name="side"
            value={side}
            options={[
              { value: "", label: "Both sides" },
              { value: "bride", label: HOUSEHOLD_SIDE_LABELS.bride },
              { value: "groom", label: HOUSEHOLD_SIDE_LABELS.groom },
            ]}
            onChange={(e) => {
              setSide(e.target.value as "" | HouseholdSide);
            }}
          />
        ) : null}
        <SelectField
          label="Invite status"
          hideLabel
          name="state"
          value={state}
          options={[
            { value: "", label: "Any invite status" },
            ...MESSAGE_STATES.map((s) => ({ value: s, label: MESSAGE_STATE_LABELS[s] })),
          ]}
          onChange={(e) => {
            setState(e.target.value as "" | MessageState);
          }}
        />
      </div>

      <p className="text-ink-muted text-sm" aria-live="polite">
        {shown.length} {shown.length === 1 ? "family" : "families"} · {guestCount}{" "}
        {guestCount === 1 ? "guest" : "guests"}
      </p>

      {households.length === 0 ? (
        <div className="border-hairline rounded-card border border-dashed p-8 text-center">
          <p className="font-serif text-xl">No guests yet</p>
          <p className="text-ink-muted mt-2">
            Add families one by one, or import a spreadsheet of everyone at once.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((h) => {
            const answered = h.rsvps.length;
            const coming = h.rsvps.reduce((n, r) => n + (r.attending ? r.headcount : 0), 0);
            return (
              <li key={h.id}>
                <Link
                  href={`/weddings/${weddingId}/guests/${h.id}`}
                  className="border-hairline rounded-card hover:border-emerald/40 block border bg-white p-4 transition sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{h.name}</p>
                      <p className="text-ink-muted mt-0.5 truncate text-sm">
                        {h.guests.map((g) => g.name).join(", ")}
                      </p>
                    </div>
                    <Chip tone={STATE_TONE[h.message.state]}>
                      {MESSAGE_STATE_LABELS[h.message.state]}
                    </Chip>
                  </div>
                  <div className="text-ink-muted mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span>{HOUSEHOLD_SIDE_LABELS[h.side]}</span>
                    {h.group ? <span>{h.group}</span> : null}
                    <span>Up to {h.maxHeadcount}</span>
                    <span
                      className={cn(h.invitedEventIds.length === 0 && "text-danger font-medium")}
                    >
                      {h.invitedEventIds.length === 0
                        ? "Not invited to any event"
                        : h.invitedEventIds.map((id) => eventName.get(id) ?? "Event").join(", ")}
                    </span>
                    {answered ? (
                      <span className="text-emerald font-medium">
                        {coming} coming ({answered}/{h.invitedEventIds.length} answered)
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
