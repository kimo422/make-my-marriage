"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { SubmitEvent } from "react";

import { authErrorMessage } from "@/components/auth/auth-errors";
import { useAuthForm } from "@/components/auth/form-state";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { PasswordField } from "@/components/ui/password-field";
import { authClient } from "@/lib/auth/client";
import { safeNextPath } from "@/lib/auth/redirect";
import { signUpSchema } from "@/modules/auth/schema";

export function SignUpForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"), "/weddings/new");
  const { fieldErrors, formError, setFormError, pending, setPending, read } =
    useAuthForm(signUpSchema);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = read(event.currentTarget);
    if (!input) return;

    setPending(true);
    const { error } = await authClient.signUp.email(input);
    if (error) {
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
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <Field
        label="Your name"
        name="name"
        autoComplete="name"
        placeholder="e.g. Santhvana Rao"
        error={fieldErrors.name}
      />
      <Field
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="you@family.com"
        hint="Use an email you can open — it's how you reset your password."
        error={fieldErrors.email}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="new-password"
        hint="At least 8 characters"
        error={fieldErrors.password}
      />
      <Button type="submit" className="mt-2" disabled={pending}>
        {pending ? "Creating your account…" : "Create account"}
      </Button>
      <p className="text-center">
        Already have an account?{" "}
        <Link
          href={next === "/weddings/new" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`}
          className="text-emerald font-medium underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
