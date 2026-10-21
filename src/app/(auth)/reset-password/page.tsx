import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { FormFallback } from "@/components/auth/form-fallback";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Create a secure password to protect your family workspace."
    >
      {/* The form reads the emailed ?token= on the client. */}
      <Suspense fallback={<FormFallback />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
