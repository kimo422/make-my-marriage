import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { loadWedding } from "@/app/(app)/weddings/[weddingId]/load";
import { FormFallback } from "@/components/auth/form-fallback";
import { ImportWizard } from "@/components/guests/import-wizard";
import { listWeddingEvents } from "@/modules/events";

export const metadata: Metadata = { title: "Import guests" };

export default function ImportPage({ params }: PageProps<"/weddings/[weddingId]/guests/import">) {
  return (
    <Suspense fallback={<FormFallback fields={3} />}>
      <Import params={params} />
    </Suspense>
  );
}

async function Import({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { wedding } = await loadWedding(
    weddingId,
    `/weddings/${weddingId}/guests/import`,
    "guests.edit",
  );
  const events = await listWeddingEvents(wedding.id);
  return (
    <div className="space-y-6">
      <div>
        <Link href={`/weddings/${wedding.id}/guests`} className="text-emerald text-sm font-medium">
          ← Guests
        </Link>
        <h1 className="mt-2 font-serif text-[2rem] leading-tight tracking-tight">
          Import a spreadsheet
        </h1>
        <p className="text-ink-muted mt-1">Nothing is saved until you&apos;ve checked the list.</p>
      </div>
      <ImportWizard
        weddingId={wedding.id}
        events={events.map((e) => ({ id: e.id, name: e.name }))}
      />
    </div>
  );
}
