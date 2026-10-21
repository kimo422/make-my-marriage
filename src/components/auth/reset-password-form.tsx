"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { SubmitEvent } from "react";

import { authErrorMessage } from "@/components/auth/auth-errors";
import { useAuthForm } from "@/components/auth/form-state";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { PasswordField } from "@/components/ui/password-field";
import { authClient } from "@/lib/auth/client";
import { resetPasswordSchema } from "@/modules/auth/schema";

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Better Auth's emailed link checks the token, then sends people here with
  // ?token=… when it's valid or ?error=INVALID_TOKEN when it isn't.
  const token = params.get("token");
  const linkBroken = !token || params.has("error");
  const { fieldErrors, formError, setFormError, pending, setPending, read } =
    useAuthForm(resetPasswordSchema);

  if (linkBroken) {
    return (
      <div className="space-y-5">
        <FormAlert>{authErrorMessage({ code: "INVALID_TOKEN" })}</FormAlert>
        <Link
          href="/forgot-password"
          className="bg-emerald text-ivory hover:bg-emerald-hover inline-flex h-12 w-full items-center justify-center rounded-full font-medium"
        >
          Send a new link
        </Link>
      </div>
    );
  }

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = read(event.currentTarget);
    if (!input || !token) return;

    setPending(true);
    const { error } = await authClient.resetPassword({ newPassword: input.newPassword, token });
    if (error) {
      setFormError(authErrorMessage(error));
      setPending(false);
      return;
    }
    router.replace("/sign-in?reset=1");
  }

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(event) => {
        void onSubmit(event);
      }}
    >
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <PasswordField
        label="New password"
        name="newPassword"
        autoComplete="new-password"
        hint="At least 8 characters"
        error={fieldErrors.newPassword}
      />
      <PasswordField
        label="Confirm new password"
        name="confirmPassword"
        autoComplete="new-password"
        error={fieldErrors.confirmPassword}
      />
      <Button type="submit" className="mt-2" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </Button>
      <p className="text-ink-muted flex items-center justify-center gap-2 text-sm">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect
            x="5"
            y="10"
            width="14"
            height="10"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.75" />
        </svg>
        You&apos;ll be signed out on your other devices.
      </p>
    </form>
  );
}
