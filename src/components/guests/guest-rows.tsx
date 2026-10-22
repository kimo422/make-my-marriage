"use client";

import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { api, ApiClientError } from "@/lib/api-client";
import { formatPhone } from "@/lib/phone";
import type { GuestDto } from "@/modules/guests/types";

interface Props {
  weddingId: string;
  householdId: string;
  primaryGuestId: string | null;
  guests: GuestDto[];
  canEdit: boolean;
}

/** The family's guests; each one opens into a small form when the team edits it. */
export function GuestRows({ weddingId, householdId, primaryGuestId, guests, canEdit }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <ul className="divide-hairline divide-y">
      {guests.map((g) =>
        editing === g.id ? (
          <li key={g.id} className="py-4">
            <GuestEditor
              weddingId={weddingId}
              guest={g}
              isPrimary={g.id === primaryGuestId}
              onDone={() => {
                setEditing(null);
              }}
            />
          </li>
        ) : (
          <li key={g.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-medium">
                {g.name}
                {g.id === primaryGuestId ? (
                  <span className="text-emerald ml-2 text-xs font-semibold">Main contact</span>
                ) : null}
                {g.isChild ? <span className="text-ink-muted ml-2 text-xs">Child</span> : null}
              </p>
              <p className="text-ink-muted truncate text-sm">
                {[g.relation, g.phone ? formatPhone(g.phone) : null, g.email]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {canEdit ? (
              <button
                type="button"
                className="text-emerald shrink-0 text-sm font-medium"
                onClick={() => {
                  setEditing(g.id);
                }}
              >
                Edit
              </button>
            ) : null}
          </li>
        ),
      )}
      {canEdit && guests.length < 20 ? (
        <li className="pt-4">
          {editing === "new" ? (
            <GuestEditor
              weddingId={weddingId}
              householdId={householdId}
              onDone={() => {
                setEditing(null);
              }}
            />
          ) : (
            <Button
              variant="secondary"
              className="h-11 w-auto"
              onClick={() => {
                setEditing("new");
              }}
            >
              Add a guest
            </Button>
          )}
        </li>
      ) : null}
    </ul>
  );
}

function GuestEditor({
  weddingId,
  guest,
  householdId,
  isPrimary = false,
  onDone,
}: {
  weddingId: string;
  guest?: GuestDto;
  householdId?: string;
  isPrimary?: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    setFieldErrors({});
    setPending(true);
    try {
      await fn();
      router.refresh();
      onDone();
    } catch (e) {
      if (e instanceof ApiClientError && Object.keys(e.fields).length) setFieldErrors(e.fields);
      else setError(e instanceof Error ? e.message : "Couldn't save.");
      setPending(false);
    }
  }

  function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const get = (key: string) => {
      const v = form.get(key);
      return typeof v === "string" ? v.trim() : "";
    };
    const body = {
      name: get("name"),
      phone: get("phone"),
      email: get("email"),
      relation: get("relation"),
      isChild: form.get("isChild") === "on",
    };
    void act(() =>
      guest
        ? api("PATCH", `/api/weddings/${weddingId}/guests/${guest.id}`, body)
        : api("POST", `/api/weddings/${weddingId}/households/${householdId ?? ""}/guests`, body),
    );
  }

  return (
    <form noValidate className="space-y-4" onSubmit={onSubmit}>
      {error ? <FormAlert>{error}</FormAlert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" defaultValue={guest?.name ?? ""} error={fieldErrors.name} />
        <Field
          label="WhatsApp number"
          name="phone"
          type="tel"
          inputMode="tel"
          defaultValue={guest?.phone ?? ""}
          error={fieldErrors.phone}
        />
        <Field label="Relation" name="relation" defaultValue={guest?.relation ?? ""} />
        <Field
          label="Email"
          name="email"
          type="email"
          defaultValue={guest?.email ?? ""}
          error={fieldErrors.email}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isChild"
          defaultChecked={guest?.isChild ?? false}
          className="accent-emerald size-4"
        />
        Child
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" className="h-11 w-auto" disabled={pending}>
          {guest ? "Save" : "Add guest"}
        </Button>
        <Button variant="secondary" className="h-11 w-auto" onClick={onDone}>
          Cancel
        </Button>
        {guest && !isPrimary ? (
          <button
            type="button"
            className="text-ink-muted hover:text-danger ml-auto text-sm"
            disabled={pending}
            onClick={() => {
              if (window.confirm(`Remove ${guest.name}?`)) {
                void act(() => api("DELETE", `/api/weddings/${weddingId}/guests/${guest.id}`));
              }
            }}
          >
            Remove guest
          </button>
        ) : null}
      </div>
    </form>
  );
}

/** Deletes the family with its guests and answers, after a confirm. */
export function DeleteHousehold({
  weddingId,
  householdId,
  name,
}: {
  weddingId: string;
  householdId: string;
  name: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {error ? <FormAlert>{error}</FormAlert> : null}
      <button
        type="button"
        className="text-danger text-sm font-medium"
        onClick={() => {
          if (!window.confirm(`Remove ${name}, their guests and their answers?`)) return;
          void api("DELETE", `/api/weddings/${weddingId}/households/${householdId}`)
            .then(() => {
              router.push(`/weddings/${weddingId}/guests`);
              router.refresh();
            })
            .catch((e: unknown) => {
              setError(e instanceof Error ? e.message : "Couldn't remove the family.");
            });
        }}
      >
        Remove this family
      </button>
    </div>
  );
}
