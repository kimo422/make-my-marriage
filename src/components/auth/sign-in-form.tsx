"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type SubmitEvent } from "react";

import { authErrorMessage } from "@/components/auth/auth-errors";
import { useAuthForm } from "@/components/auth/form-state";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { PasswordField } from "@/components/ui/password-field";
import { authClient } from "@/lib/auth/client";
import { safeNextPath } from "@/lib/auth/redirect";
import { signInSchema } from "@/modules/auth/schema";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"), "/weddings");
  const justReset = params.has("reset");
  const { fieldErrors, formError, setFormError, pending, setPending, read } =
    useAuthForm(signInSchema);
  const [offerReset, setOfferReset] = useState(false);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = read(event.currentTarget);
    if (!input) return;

    setPending(true);
    const { error } = await authClient.signIn.email(input);
    if (error) {
      setOfferReset(error.code === "INVALID_EMAIL_OR_PASSWORD");
      setFormError(authErrorMessage(error));
      setPending(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(event) => {
        void onSubmit(event);
      }}
    >
      {justReset && !formError ? (
        <FormAlert tone="success">Password changed. Sign in with your new password.</FormAlert>
      ) : null}
      {formError ? (
        <FormAlert>
          {formError}{" "}
          {offerReset ? (
            <Link href="/forgot-password" className="underline underline-offset-2">
              Reset it now
            </Link>
          ) : null}
        </FormAlert>
      ) : null}
      <Field
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="you@family.com"
        error={fieldErrors.email}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        error={fieldErrors.password}
        aside={
          <Link href="/forgot-password" className="text-ink-muted hover:text-ink text-sm">
            Forgot password?
          </Link>
        }
      />
      <Button type="submit" className="mt-2" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center">
        New here?{" "}
        <Link href="/sign-up" className="text-emerald font-medium underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </form>
  );
}
