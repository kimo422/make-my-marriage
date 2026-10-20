import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { Field } from "@/components/ui/field";

export const metadata: Metadata = { title: "Reset your password" };

// UI only: Phase 1 sends the reset email through Resend.
export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email you signed up with and we'll send you a link to set a new password."
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
        {/* Links to the confirmation state until the form is wired up. */}
        <Link
          href="/forgot-password/sent"
          className="bg-emerald text-ivory hover:bg-emerald-hover inline-flex h-12 w-full items-center justify-center rounded-full font-medium transition active:scale-[0.98]"
        >
          Send reset link
        </Link>
        <div className="border-hairline border-t pt-5 text-center">
          <Link href="/sign-in" className="text-emerald font-medium">
            ‹ Back to sign in
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
