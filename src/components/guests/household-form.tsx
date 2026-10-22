"use client";

import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import { ArchCard } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { SelectField } from "@/components/ui/select-field";
import { api, ApiClientError } from "@/lib/api-client";
import {
  HOUSEHOLD_SIDE_LABELS,
  HOUSEHOLD_SIDES,
  type HouseholdSide,
} from "@/modules/guests/schema";
import type { HouseholdDto } from "@/modules/guests/types";

interface GuestDraft {
  key: number;
  name: string;
  phone: string;
  email: string;
  relation: string;
  isChild: boolean;
}

const blankGuest = (key: number): GuestDraft => ({
  key,
  name: "",
  phone: "",
  email: "",
  relation: "",
  isChild: false,
});

interface Props {
  weddingId: string;
  events: { id: string; name: string; when: string }[];
  /** Present when editing; guests are then edited one by one below the form. */
  household?: HouseholdDto;
  /** An organizer's own side, when they only have one. */
  fixedSide: HouseholdSide | null;
}

export function HouseholdForm({ weddingId, events, household, fixedSide }: Props) {
  const router = useRouter();
  const [guests, setGuests] = useState<GuestDraft[]>([blankGuest(0)]);
  const [invited, setInvited] = useState<string[]>(
    household?.invitedEventIds ?? events.map((e) => e.id),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  function updateGuest(key: number, patch: Partial<GuestDraft>) {
    setGuests((list) => list.map((g) => (g.key === key ? { ...g, ...patch } : g)));
  }

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const get = (key: string) => {
      const v = form.get(key);
      return typeof v === "string" ? v.trim() : "";
    };
    const max = get("maxHeadcount");
    const body = {
      name: get("name"),
      side: fixedSide ?? get("side"),
      group: get("group"),
      ...(max ? { maxHeadcount: Number(max) } : {}),
      invitedEventIds: invited,
      notes: get("notes"),
      ...(household
        ? { primaryGuestId: get("primaryGuestId") || undefined }
        : {
            guests: guests
              .filter((g) => g.name.trim() || g.phone.trim())
              .map(({ key: _, ...g }) => g),
          }),
    };
    setFieldErrors({});
    setFormError(null);
    setSaved(false);
    setPending(true);
    try {
      if (household) {
        await api("PATCH", `/api/weddings/${weddingId}/households/${household.id}`, body);
        setSaved(true);
        router.refresh();
      } else {
        const created = await api<HouseholdDto>(
          "POST",
          `/api/weddings/${weddingId}/households`,
          body,
        );
        router.push(`/weddings/${weddingId}/guests/${created.id}`);
        router.refresh();
      }
    } catch (error) {
      if (error instanceof ApiClientError && Object.keys(error.fields).length) {
        setFieldErrors(error.fields);
        setFormError("Please check the highlighted fields.");
      } else {
        setFormError(error instanceof Error ? error.message : "Couldn't save the family.");
      }
    } finally {
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
      {saved ? <FormAlert tone="success">Saved.</FormAlert> : null}
      <ArchCard className="space-y-5">
        <Field
          label="Family name"
          name="name"
          defaultValue={household?.name ?? ""}
          placeholder="Sharma family"
          error={fieldErrors.name}
        />
        <div className="grid gap-5 sm:grid-cols-3">
          {fixedSide ? (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold">Side</p>
              <p className="flex h-12 items-center">{HOUSEHOLD_SIDE_LABELS[fixedSide]}</p>
            </div>
          ) : (
            <SelectField
              label="Side"
              name="side"
              defaultValue={household?.side ?? "bride"}
              options={HOUSEHOLD_SIDES.map((s) => ({ value: s, label: HOUSEHOLD_SIDE_LABELS[s] }))}
              error={fieldErrors.side}
            />
          )}
          <Field
            label="Group"
            name="group"
            defaultValue={household?.group ?? ""}
            placeholder="Office friends"
            hint="Optional"
            error={fieldErrors.group}
          />
          <Field
            label="Seats"
            name="maxHeadcount"
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            defaultValue={household?.maxHeadcount ?? ""}
            hint={household ? "Most who can come" : "Defaults to the guests listed"}
            error={fieldErrors.maxHeadcount}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Invited to</legend>
          {events.length === 0 ? (
            <p className="text-ink-muted text-sm">Add events first, then choose them here.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {events.map((ev) => (
                <label
                  key={ev.id}
                  className="border-hairline bg-field has-checked:border-emerald has-checked:bg-emerald-soft rounded-field flex cursor-pointer items-center gap-3 border px-4 py-3"
                >
                  <input
                    type="checkbox"
                    className="accent-emerald size-4"
                    checked={invited.includes(ev.id)}
                    onChange={(e) => {
                      setInvited((list) =>
                        e.target.checked ? [...list, ev.id] : list.filter((id) => id !== ev.id),
                      );
                    }}
                  />
                  <span>
                    <span className="block font-medium">{ev.name}</span>
                    <span className="text-ink-muted block text-sm">{ev.when}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          {fieldErrors.invitedEventIds ? (
            <p className="text-danger text-sm">{fieldErrors.invitedEventIds}</p>
          ) : null}
        </fieldset>

        {household && household.guests.length > 1 ? (
          <SelectField
            label="Main contact (gets the WhatsApp invite)"
            name="primaryGuestId"
            defaultValue={household.primaryGuestId ?? ""}
            options={household.guests.map((g) => ({ value: g.id, label: g.name }))}
            error={fieldErrors.primaryGuestId}
          />
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="notes" className="text-sm font-semibold">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            defaultValue={household?.notes ?? ""}
            placeholder="Arriving from Pune on the 10th"
            className="border-hairline bg-field rounded-field focus:border-emerald focus:ring-emerald/15 w-full border px-4 py-3 focus:ring-2 focus:outline-none"
          />
        </div>
      </ArchCard>

      {household ? null : (
        <ArchCard className="space-y-5">
          <div>
            <h2 className="font-serif text-xl">Guests</h2>
            <p className="text-ink-muted text-sm">
              The first adult with a phone number gets the WhatsApp invite.
            </p>
          </div>
          {fieldErrors.guests ? <p className="text-danger text-sm">{fieldErrors.guests}</p> : null}
          {guests.map((g, i) => (
            <div
              key={g.key}
              className="border-hairline space-y-4 border-t pt-5 first:border-0 first:pt-0"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Name"
                  name={`guest-${String(g.key)}-name`}
                  value={g.name}
                  error={fieldErrors[`guests.${String(i)}.name`]}
                  onChange={(e) => {
                    updateGuest(g.key, { name: e.target.value });
                  }}
                />
                <Field
                  label="WhatsApp number"
                  name={`guest-${String(g.key)}-phone`}
                  type="tel"
                  inputMode="tel"
                  value={g.phone}
                  placeholder="98765 43210"
                  error={fieldErrors[`guests.${String(i)}.phone`]}
                  onChange={(e) => {
                    updateGuest(g.key, { phone: e.target.value });
                  }}
                />
                <Field
                  label="Relation"
                  name={`guest-${String(g.key)}-relation`}
                  value={g.relation}
                  placeholder="Mama ji"
                  onChange={(e) => {
                    updateGuest(g.key, { relation: e.target.value });
                  }}
                />
                <Field
                  label="Email"
                  name={`guest-${String(g.key)}-email`}
                  type="email"
                  value={g.email}
                  error={fieldErrors[`guests.${String(i)}.email`]}
                  onChange={(e) => {
                    updateGuest(g.key, { email: e.target.value });
                  }}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-emerald size-4"
                    checked={g.isChild}
                    onChange={(e) => {
                      updateGuest(g.key, { isChild: e.target.checked });
                    }}
                  />
                  Child
                </label>
                {guests.length > 1 ? (
                  <button
                    type="button"
                    className="text-ink-muted hover:text-danger text-sm"
                    onClick={() => {
                      setGuests((list) => list.filter((x) => x.key !== g.key));
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {guests.length < 20 ? (
            <Button
              variant="secondary"
              className="h-11 w-auto"
              onClick={() => {
                setGuests((list) => [...list, blankGuest(Math.max(...list.map((g) => g.key)) + 1)]);
              }}
            >
              Add another guest
            </Button>
          ) : null}
        </ArchCard>
      )}

      <Button type="submit" disabled={pending} className="sm:w-auto">
        {pending ? "Saving…" : household ? "Save changes" : "Add family"}
      </Button>
    </form>
  );
}
