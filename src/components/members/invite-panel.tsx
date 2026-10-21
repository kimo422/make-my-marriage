"use client";

import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { SelectField } from "@/components/ui/select-field";
import { api, ApiClientError } from "@/lib/api-client";
import { formatLongDate } from "@/lib/dates";
import { toFieldErrors } from "@/lib/validation/common";
import { ROLE_LABELS, ROLES, SIDE_LABELS, SIDES } from "@/modules/members/permissions";
import { createInviteSchema } from "@/modules/members/schema";
import type { CreatedInviteDto, InviteDto } from "@/modules/members/types";

interface Props {
  weddingId: string;
  coupleNames: string;
  invites: InviteDto[];
  canManageOwners: boolean;
}

/** Decision 2: invites are links the inviter shares (usually on WhatsApp); no email is sent. */
export function InvitePanel({ weddingId, coupleNames, invites, canManageOwners }: Props) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<CreatedInviteDto | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const parsed = createInviteSchema.safeParse(Object.fromEntries(new FormData(formEl)));
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setPending(true);
    try {
      const result = await api<CreatedInviteDto>(
        "POST",
        `/api/weddings/${weddingId}/invites`,
        parsed.data,
      );
      setCreated(result);
      setCopied(false);
      formEl.reset();
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError && Object.keys(error.fields).length)
        setFieldErrors(error.fields);
      else setFormError(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  const message = created
    ? `Namaste! Please join me in planning ${coupleNames}'s wedding on Make My Marriage. Open this link to join as ${ROLE_LABELS[created.invite.role].toLowerCase()}: ${created.inviteUrl}`
    : "";

  return (
    <section
      aria-labelledby="invite-heading"
      className="border-hairline rounded-card space-y-5 border bg-white p-5 sm:p-6"
    >
      <div>
        <h2 id="invite-heading" className="font-serif text-xl">
          Invite family
        </h2>
        <p className="text-ink-muted mt-1 text-sm">
          Create a link and send it yourself, for example on WhatsApp. It works once, for that email
          address, for 7 days.
        </p>
      </div>

      {created ? (
        <div className="border-emerald/20 bg-emerald-soft rounded-card space-y-3 border p-4">
          <p className="text-emerald text-sm font-semibold">
            Link ready for {created.invite.email}. Copy it now; it isn&apos;t shown again.
          </p>
          <p className="border-hairline rounded-field bg-white p-3 font-mono text-xs break-all">
            {created.inviteUrl}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(created.inviteUrl).then(() => {
                  setCopied(true);
                });
              }}
            >
              {copied ? "Copied ✓" : "Copy link"}
            </Button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-emerald text-ivory hover:bg-emerald-hover inline-flex h-12 items-center justify-center rounded-full font-medium"
            >
              Share on WhatsApp
            </a>
          </div>
        </div>
      ) : null}

      <form
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          void onSubmit(event);
        }}
      >
        {formError ? <FormAlert>{formError}</FormAlert> : null}
        <Field
          label="Their email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="amma@family.com"
          hint="They'll sign in or create an account with this email to join."
          error={fieldErrors.email}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Role"
            name="role"
            defaultValue="organizer"
            options={ROLES.filter((r) => canManageOwners || r !== "owner").map((r) => ({
              value: r,
              label: ROLE_LABELS[r],
            }))}
            error={fieldErrors.role}
          />
          <SelectField
            label="Side"
            name="side"
            defaultValue="both"
            options={SIDES.map((s) => ({ value: s, label: SIDE_LABELS[s] }))}
            error={fieldErrors.side}
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating link…" : "Create invite link"}
        </Button>
      </form>

      {invites.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Waiting to join</h3>
          <ul className="divide-hairline border-hairline rounded-field divide-y border">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate">{inv.email}</span>
                  <span className="text-ink-muted block text-sm">
                    {ROLE_LABELS[inv.role]} · {SIDE_LABELS[inv.side]} · until{" "}
                    {formatLongDate(inv.expiresAt.slice(0, 10))}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void api("DELETE", `/api/weddings/${weddingId}/invites/${inv.id}`).then(() => {
                      router.refresh();
                    });
                  }}
                  className="text-ink-muted hover:bg-stone hover:text-ink rounded-full px-3 py-2 text-sm"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
