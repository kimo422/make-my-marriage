"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SubmitEvent } from "react";

import { authErrorMessage } from "@/components/auth/auth-errors";
import { useAuthForm } from "@/components/auth/form-state";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { authClient } from "@/lib/auth/client";
import { forgotPasswordSchema } from "@/modules/auth/schema";

export function ForgotPasswordForm() {
  const router = useRouter();
  const { fieldErrors, formError, setFormError, pending, setPending, read } =
    useAuthForm(forgotPasswordSchema);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = read(event.currentTarget);
    if (!input) return;

    setPending(true);
    // Better Auth answers the same way whether or not the account exists, so
    // this screen never reveals who has signed up.
    const { error } = await authClient.requestPasswordReset({
      email: input.email,
      redirectTo: "/reset-password",
    });
    if (error) {
      setFormError(authErrorMessage(error));
      setPending(false);
      return;
    }
    router.push("/forgot-password/sent");
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
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="you@family.com"
        error={fieldErrors.email}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <div className="border-hairline border-t pt-5 text-center">
        <Link href="/sign-in" className="text-emerald font-medium">
          ‹ Back to sign in
        </Link>
      </div>
    </form>
  );
}
