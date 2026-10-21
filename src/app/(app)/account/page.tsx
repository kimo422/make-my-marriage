import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { FormFallback } from "@/components/auth/form-fallback";
import { RequireUser } from "@/components/auth/require-user";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ArchCard } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Your account" };

export default function AccountPage() {
  return (
    <>
      <header className="border-hairline border-b">
        <div className="mx-auto flex h-16 max-w-xl items-center px-4">
          <Logo />
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl px-4 py-8">
        <h1 className="font-serif text-[2rem] leading-tight tracking-tight">Your account</h1>
        <div className="mt-6">
          <Suspense fallback={<FormFallback />}>
            <RequireUser returnTo="/account">
              {(user) => (
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
                    href="/weddings/new"
                    className="bg-emerald text-ivory hover:bg-emerald-hover inline-flex h-12 w-full items-center justify-center rounded-full font-medium"
                  >
                    Set up your wedding
                  </Link>
                  <SignOutButton />
                </ArchCard>
              )}
            </RequireUser>
          </Suspense>
        </div>
      </main>
    </>
  );
}
