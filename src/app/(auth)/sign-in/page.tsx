import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell, LegalNote } from "@/components/auth/auth-shell";
import { FormFallback } from "@/components/auth/form-fallback";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue planning."
      below={<LegalNote verb="signing in" />}
    >
      {/* The form reads ?next= and ?reset= on the client. */}
      <Suspense fallback={<FormFallback />}>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}
