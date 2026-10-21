"use client";

import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import { ArchCard } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { SelectField } from "@/components/ui/select-field";
import { api, ApiClientError } from "@/lib/api-client";
import { addDays, isDateOnly, isTime, utcToZoned, zonedToUtc } from "@/lib/dates";
import { EVENT_TYPE_LABELS, EVENT_TYPES, type EventType } from "@/modules/events/schema";
import type { EventDto } from "@/modules/events/types";

interface Props {
  weddingId: string;
  timezone: string;
  /** Present when editing. */
  event?: EventDto;
  /** Suggested date for a new event (the main wedding date). */
  defaultDate: string;
}

export function EventForm({ weddingId, timezone, event, defaultDate }: Props) {
  const router = useRouter();
  const start = event ? utcToZoned(event.startAt, timezone) : { date: defaultDate, time: "" };
  const end = event ? utcToZoned(event.endAt, timezone) : { date: defaultDate, time: "" };
  const [type, setType] = useState<EventType>(event?.type ?? "haldi");
  const [name, setName] = useState(event?.name ?? EVENT_TYPE_LABELS.haldi);
  const [nameEdited, setNameEdited] = useState(Boolean(event));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const get = (key: string) => {
      const v = form.get(key);
      return typeof v === "string" ? v.trim() : "";
    };
    const date = get("date");
    const startTime = get("startTime");
    const endTime = get("endTime");
    const errors: Record<string, string> = {};
    if (!isDateOnly(date)) errors.date = "Choose the date";
    if (!isTime(startTime)) errors.startTime = "Choose a start time";
    if (!isTime(endTime)) errors.endTime = "Choose an end time";
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    // A late night that runs past midnight: an end before the start means the next day.
    const endDate = endTime <= startTime ? addDays(date, 1) : date;
    const body = {
      name,
      type,
      startAt: zonedToUtc(date, startTime, timezone).toISOString(),
      endAt: zonedToUtc(endDate, endTime, timezone).toISOString(),
      venue: { name: get("venueName"), address: get("venueAddress"), mapUrl: get("mapUrl") },
      dressCode: get("dressCode"),
      notes: get("notes"),
      isPublic: form.get("isPublic") === "on",
    };

    setFieldErrors({});
    setFormError(null);
    setPending(true);
    try {
      if (event) await api("PATCH", `/api/weddings/${weddingId}/events/${event.id}`, body);
      else await api("POST", `/api/weddings/${weddingId}/events`, body);
      router.push(`/weddings/${weddingId}/events`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError && Object.keys(error.fields).length) {
        const f = error.fields;
        setFieldErrors({
          ...f,
          ...(f.endAt ? { endTime: f.endAt } : {}),
          ...(f["venue.mapUrl"] ? { mapUrl: f["venue.mapUrl"] } : {}),
        });
      } else {
        setFormError(error instanceof Error ? error.message : "Couldn't save the event.");
      }
      setPending(false);
    }
  }

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        void onSubmit(e);
      }}
    >
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <ArchCard className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            label="Type"
            name="type"
            value={type}
            options={EVENT_TYPES.map((t) => ({ value: t, label: EVENT_TYPE_LABELS[t] }))}
            onChange={(e) => {
              const next = e.target.value as EventType;
              setType(next);
              if (!nameEdited) setName(next === "custom" ? "" : EVENT_TYPE_LABELS[next]);
            }}
          />
          <Field
            label="Name"
            name="name"
            value={name}
            placeholder="Haldi"
            error={fieldErrors.name}
            onChange={(e) => {
              setNameEdited(true);
              setName(e.target.value);
            }}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field
            label="Date"
            name="date"
            type="date"
            defaultValue={start.date}
            error={fieldErrors.date}
          />
          <Field
            label="Starts"
            name="startTime"
            type="time"
            defaultValue={start.time}
            error={fieldErrors.startTime}
          />
          <Field
            label="Ends"
            name="endTime"
            type="time"
            defaultValue={end.time}
            hint="Ending after midnight is fine."
            error={fieldErrors.endTime}
          />
        </div>
        <Field
          label="Venue"
          name="venueName"
          defaultValue={event?.venue.name ?? ""}
          placeholder="Taj Krishna"
        />
        <Field
          label="Address"
          name="venueAddress"
          defaultValue={event?.venue.address ?? ""}
          placeholder="Road No. 1, Banjara Hills, Hyderabad"
        />
        <Field
          label="Map link (optional)"
          name="mapUrl"
          type="url"
          inputMode="url"
          defaultValue={event?.venue.mapUrl ?? ""}
          placeholder="https://maps.app.goo.gl/…"
          hint="Paste the share link from Google Maps."
          error={fieldErrors.mapUrl}
        />
        <Field
          label="Dress code (optional)"
          name="dressCode"
          defaultValue={event?.dressCode ?? ""}
          placeholder="Shades of yellow"
          error={fieldErrors.dressCode}
        />
        <div className="space-y-1.5">
          <label htmlFor="notes" className="text-sm font-semibold">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            maxLength={1000}
            defaultValue={event?.notes ?? ""}
            className="rounded-field border-hairline bg-field focus:border-emerald focus:ring-emerald/15 w-full border px-4 py-3 focus:ring-2 focus:outline-none"
          />
        </div>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="isPublic"
            defaultChecked={event?.isPublic ?? true}
            className="accent-emerald mt-1 size-5"
          />
          <span>
            <span className="font-medium">Show on the wedding website</span>
            <span className="text-ink-muted block text-sm">
              Turn off for private functions like a family-only puja.
            </span>
          </span>
        </label>
      </ArchCard>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : event ? "Save event" : "Add event"}
      </Button>
    </form>
  );
}
