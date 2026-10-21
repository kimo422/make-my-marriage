import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AppHeader } from "@/components/app/app-header";
import { DeleteAccount } from "@/components/auth/delete-account";
import { FormFallback } from "@/components/auth/form-fallback";
import { RequireUser } from "@/components/auth/require-user";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ArchCard } from "@/components/ui/card";

export const metadata: Metadata = { title: "Your account" };

export default function AccountPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-xl space-y-6 px-4 py-8">
        <h1 className="font-serif text-[2rem] leading-tight tracking-tight">Your account</h1>
        <Suspense fallback={<FormFallback />}>
          <RequireUser returnTo="/account">
            {(user) => (
              <div className="space-y-6">
                <ArchCard className="space-y-6">
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-ink-muted text-sm">Name</dt>
                      <dd className="text-lg">{user.name}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted text-sm">Email</dt>
                      {/* Shown prominently: without email verification, this is how a typo gets noticed. */}
                      <dd className="text-lg break-all">{user.email}</dd>
                    </div>
                  </dl>
                  <Link
                    href="/weddings?pick=1"
                    className="bg-emerald text-ivory hover:bg-emerald-hover inline-flex h-12 w-full items-center justify-center rounded-full font-medium"
                  >
                    Your weddings
                  </Link>
                  <SignOutButton />
                </ArchCard>
                <DeleteAccount />
              </div>
            )}
          </RequireUser>
        </Suspense>
      </main>
    </>
  );
}
