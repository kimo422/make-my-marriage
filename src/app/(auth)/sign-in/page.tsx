import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell, LegalNote } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";

export const metadata: Metadata = { title: "Sign in" };

// UI only: the form is wired to Better Auth in Phase 1. The banner previews the
// failed-sign-in state; it will only render after a failed attempt.
export default function SignInPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue planning."
      below={
        <>
          <div
            role="alert"
            className="rounded-card border-hairline bg-stone/60 flex gap-3 border p-4 text-sm"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="mt-0.5 shrink-0"
            >
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 7.5v5.5M12 16.5v.01" stroke="currentColor" strokeWidth="1.75" />
            </svg>
            <p>
              That email and password don&apos;t match. Try again or{" "}
              <Link href="/forgot-password" className="underline underline-offset-2">
                reset your password
              </Link>
              .
            </p>
          </div>
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
