import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { loadWedding } from "@/app/(app)/weddings/[weddingId]/load";
import { FormFallback } from "@/components/auth/form-fallback";
import { InviteQueue } from "@/components/guests/invite-queue";
import { listHouseholds } from "@/modules/guests";

export const metadata: Metadata = { title: "Send invites" };

export default function InvitesPage({ params }: PageProps<"/weddings/[weddingId]/guests/invites">) {
  return (
    <Suspense fallback={<FormFallback fields={4} />}>
      <Invites params={params} />
    </Suspense>
  );
}

async function Invites({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const ctx = await loadWedding(weddingId, `/weddings/${weddingId}/guests/invites`, "guests.edit");
  const households = await listHouseholds(ctx);
  const base = `/weddings/${ctx.wedding.id}/guests`;
  return (
    <div className="space-y-6">
      <div>
        <Link href={base} className="text-emerald text-sm font-medium">
          ← Guests
        </Link>
        <h1 className="mt-2 font-serif text-[2rem] leading-tight tracking-tight">
          Send invites on WhatsApp
        </h1>
        <p className="text-ink-muted mt-1">
          Each message opens in your own WhatsApp with the family&apos;s RSVP link ready. The app
          never sends anything by itself.{" "}
          <Link href={`${base}/templates`} className="text-emerald underline underline-offset-2">
            Change the wording
          </Link>
        </p>
      </div>
      <InviteQueue weddingId={ctx.wedding.id} households={households} />
    </div>
  );
}
