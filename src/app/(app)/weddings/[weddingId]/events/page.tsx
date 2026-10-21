import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { loadWedding } from "@/app/(app)/weddings/[weddingId]/load";
import { FormFallback } from "@/components/auth/form-fallback";
import { EventList } from "@/components/events/event-list";
import { listWeddingEvents } from "@/modules/events";
import { can } from "@/modules/members";

export const metadata: Metadata = { title: "Events" };

export default function EventsPage({ params }: PageProps<"/weddings/[weddingId]/events">) {
  return (
    <Suspense fallback={<FormFallback fields={3} />}>
      <Events params={params} />
    </Suspense>
  );
}

async function Events({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { wedding, membership } = await loadWedding(weddingId, `/weddings/${weddingId}/events`);
  const canEdit = can(membership.role, "events.edit");
  const events = await listWeddingEvents(wedding.id);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[2rem] leading-tight tracking-tight">Events</h1>
          <p className="text-ink-muted mt-1">Every function, in order.</p>
        </div>
        {canEdit ? (
          <Link
            href={`/weddings/${wedding.id}/events/new`}
            className="bg-emerald text-ivory hover:bg-emerald-hover inline-flex h-11 shrink-0 items-center rounded-full px-5 font-medium"
          >
            Add event
          </Link>
        ) : null}
      </div>
      <EventList
        weddingId={wedding.id}
        timezone={wedding.timezone}
        events={events}
        canEdit={canEdit}
      />
    </div>
  );
}
