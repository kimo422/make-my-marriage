import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell, LegalNote } from "@/components/auth/auth-shell";
import { FormFallback } from "@/components/auth/form-fallback";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Plan every function with your family, in one calm place."
      below={<LegalNote />}
    >
      {/* The form reads ?next= on the client. */}
      <Suspense fallback={<FormFallback fields={3} />}>
        <SignUpForm />
      </Suspense>
    </AuthShell>
  );
}
