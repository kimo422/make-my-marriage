import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthShell, LegalNote } from "@/components/auth/auth-shell";
import { SignInError } from "@/components/auth/sign-in-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";

export const metadata: Metadata = { title: "Sign in" };

// UI only: the form is wired to Better Auth in Phase 1.
export default function SignInPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue planning."
      below={
        <>
          {/* Reads the query string, so it renders at request time inside the static shell. */}
          <Suspense fallback={null}>
            <SignInError />
          </Suspense>
          <LegalNote verb="signing in" />
        </>
      }
    >
      <form className="space-y-5" noValidate>
        <Field
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="ananya@family.com"
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          aside={
            <Link href="/forgot-password" className="text-ink-muted hover:text-ink text-sm">
              Forgot password?
            </Link>
          }
        />
        <Button className="mt-2">Sign in</Button>
        <p className="text-center">
          New here?{" "}
          <Link href="/sign-up" className="text-emerald font-medium underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
