import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell, LegalNote } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";

export const metadata: Metadata = { title: "Create your account" };

// UI only: the form is wired to Better Auth in Phase 1.
export default function SignUpPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Plan every function with your family, in one calm place."
      below={<LegalNote />}
    >
      <form className="space-y-5" noValidate>
        <Field label="Your name" name="name" autoComplete="name" placeholder="e.g. Ananya Rao" />
        <Field
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="ananya@family.com"
          hint="Use an email you can open — it's how you reset your password."
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="new-password"
          hint="At least 8 characters"
        />
        <Button className="mt-2">Create account</Button>
        <p className="text-center">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-emerald font-medium underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
