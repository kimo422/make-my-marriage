import type { Metadata } from "next";
import { Suspense } from "react";

import { AppHeader } from "@/components/app/app-header";
import { FormFallback } from "@/components/auth/form-fallback";
import { RequireUser } from "@/components/auth/require-user";
import { CreateWeddingForm } from "@/components/weddings/create-wedding-form";
import { env } from "@/lib/env/server";

export const metadata: Metadata = { title: "Create your wedding" };

export default function NewWeddingPage() {
  const siteHost = new URL(env.APP_URL).host;
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-xl px-4 py-8">
        <h1 className="font-serif text-[2rem] leading-tight tracking-tight">
          Let&apos;s set up your wedding
        </h1>
        <p className="text-ink-muted mt-2 mb-6">You can change any of this later.</p>
        <Suspense fallback={<FormFallback fields={5} />}>
          <RequireUser returnTo="/weddings/new">
            {() => <CreateWeddingForm siteHost={siteHost} />}
          </RequireUser>
        </Suspense>
      </main>
    </>
  );
}
