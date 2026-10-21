"use client";

import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { PasswordField } from "@/components/ui/password-field";
import { api, ApiClientError } from "@/lib/api-client";

export function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("password");
    const password = typeof value === "string" ? value : "";
    if (!password) {
      setFieldError("Enter your password to confirm");
      return;
    }
    setPending(true);
    setFieldError(undefined);
    setFormError(null);
    try {
      await api("DELETE", "/api/me", { password });
      router.replace("/");
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError && error.fields.password)
        setFieldError(error.fields.password);
      else setFormError(error instanceof Error ? error.message : "Couldn't delete your account.");
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby="delete-account"
      className="border-hairline rounded-card bg-stone/40 space-y-4 border p-5 sm:p-6"
    >
      <div>
        <h2 id="delete-account" className="font-serif text-xl">
          Delete your account
        </h2>
        <p className="text-ink-muted mt-1 text-sm">
          You&apos;ll be removed from every wedding. If you&apos;re a wedding&apos;s only owner,
          make someone else an owner or delete that wedding first.
        </p>
      </div>
      {open ? (
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            void onSubmit(event);
          }}
        >
          {formError ? <FormAlert>{formError}</FormAlert> : null}
          <PasswordField
            label="Your password"
            name="password"
            autoComplete="current-password"
            error={fieldError}
          />
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Deleting…" : "Delete my account for good"}
          </Button>
        </form>
      ) : (
        <Button
          variant="secondary"
          onClick={() => {
            setOpen(true);
          }}
        >
          Delete account…
        </Button>
      )}
    </section>
  );
}
