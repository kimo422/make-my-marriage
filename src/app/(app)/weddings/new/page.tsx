import type { Metadata } from "next";

import { Logo } from "@/components/ui/logo";
import { CreateWeddingForm } from "@/components/weddings/create-wedding-form";
import { env } from "@/lib/env/server";

export const metadata: Metadata = { title: "Create your wedding" };

export default function NewWeddingPage() {
  const siteHost = new URL(env.APP_URL).host;
  return (
    <>
      <header className="border-hairline border-b">
        <div className="mx-auto flex h-16 max-w-xl items-center px-4">
          <Logo />
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl px-4 py-8">
        <h1 className="font-serif text-[2rem] leading-tight tracking-tight">
          Let&apos;s set up your wedding
        </h1>
        <p className="text-ink-muted mt-2 mb-6">You can change any of this later.</p>
        <CreateWeddingForm siteHost={siteHost} />
      </main>
    </>
  );
}
