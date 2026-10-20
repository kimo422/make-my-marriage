import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";

export const metadata: Metadata = { title: "Choose a new password" };

// UI only: Phase 1 reads the emailed token and calls Better Auth's reset endpoint.
export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Create a secure password to protect your family workspace."
    >
      <form className="space-y-5" noValidate>
        <PasswordField
          label="New password"
          name="newPassword"
          autoComplete="new-password"
          hint="At least 8 characters"
        />
        <PasswordField
          label="Confirm new password"
          name="confirmPassword"
          autoComplete="new-password"
        />
        <Button className="mt-2">Save password</Button>
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
    </AuthShell>
  );
}
