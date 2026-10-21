import Link from "next/link";
import { Suspense } from "react";

import { AppHeader } from "@/components/app/app-header";
import { WeddingNav } from "@/components/weddings/wedding-nav";
import { can } from "@/modules/members";

import { loadWedding } from "@/app/(app)/weddings/[weddingId]/load";

export default function WeddingLayout({ children, params }: LayoutProps<"/weddings/[weddingId]">) {
  return (
    <>
      <AppHeader>
        <Link
          href="/weddings?pick=1"
          className="text-ink-muted hover:text-ink hover:bg-stone rounded-full px-3 py-2 text-sm whitespace-nowrap"
        >
          Switch
        </Link>
      </AppHeader>
      <div className="mx-auto w-full max-w-3xl px-4 pt-6">
        {/* Reads the session and the wedding, so it streams in behind the static shell. */}
        <Suspense fallback={<div className="bg-stone h-16 w-2/3 rounded-xl" aria-hidden="true" />}>
          <WeddingHeading params={params} />
        </Suspense>
      </div>
      <main className="mx-auto w-full max-w-3xl px-4 py-6">{children}</main>
    </>
  );
}

async function WeddingHeading({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { wedding, membership } = await loadWedding(weddingId, `/weddings/${weddingId}`);
  return (
    <div className="space-y-4">
      <p className="truncate font-serif text-2xl leading-tight sm:text-3xl">
        {wedding.brideName} &amp; {wedding.groomName}
      </p>
      <WeddingNav weddingId={wedding.id} canEdit={can(membership.role, "wedding.edit")} />
    </div>
  );
}
