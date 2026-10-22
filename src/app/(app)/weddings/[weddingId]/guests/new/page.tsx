import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { loadWedding } from "@/app/(app)/weddings/[weddingId]/load";
import { FormFallback } from "@/components/auth/form-fallback";
import { HouseholdForm } from "@/components/guests/household-form";
import { formatEventDay, formatTime } from "@/lib/dates";
import { listWeddingEvents } from "@/modules/events";

export const metadata: Metadata = { title: "Add a family" };

export default function NewHouseholdPage({
  params,
}: PageProps<"/weddings/[weddingId]/guests/new">) {
  return (
    <Suspense fallback={<FormFallback fields={5} />}>
      <NewHousehold params={params} />
    </Suspense>
  );
}

async function NewHousehold({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { wedding, membership } = await loadWedding(
    weddingId,
    `/weddings/${weddingId}/guests/new`,
    "guests.edit",
  );
  const events = await listWeddingEvents(wedding.id);
  const fixedSide =
    membership.role === "organizer" && membership.side !== "both" ? membership.side : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/weddings/${wedding.id}/guests`} className="text-emerald text-sm font-medium">
          ← Guests
        </Link>
        <h1 className="mt-2 font-serif text-[2rem] leading-tight tracking-tight">Add a family</h1>
        <p className="text-ink-muted mt-1">
          A family gets one invitation and one RSVP link, shared by everyone in it.
        </p>
      </div>
      <HouseholdForm
        weddingId={wedding.id}
        fixedSide={fixedSide}
        events={events.map((e) => ({
          id: e.id,
          name: e.name,
          when: `${formatEventDay(e.startAt, wedding.timezone)} · ${formatTime(e.startAt, wedding.timezone)}`,
        }))}
      />
    </div>
  );
}
