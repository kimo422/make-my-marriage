import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { loadWedding } from "@/app/(app)/weddings/[weddingId]/load";
import { FormFallback } from "@/components/auth/form-fallback";
import { EventForm } from "@/components/events/event-form";
import { findWeddingEvent } from "@/modules/events";

export const metadata: Metadata = { title: "Edit event" };

export default function EditEventPage({
  params,
}: PageProps<"/weddings/[weddingId]/events/[eventId]">) {
  return (
    <Suspense fallback={<FormFallback fields={6} />}>
      <EditEvent params={params} />
    </Suspense>
  );
}

async function EditEvent({ params }: { params: Promise<{ weddingId: string; eventId: string }> }) {
  const { weddingId, eventId } = await params;
  const { wedding } = await loadWedding(
    weddingId,
    `/weddings/${weddingId}/events/${eventId}`,
    "events.edit",
  );
  const event = await findWeddingEvent(wedding.id, eventId);
  if (!event) notFound();
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-[2rem] leading-tight tracking-tight">Edit {event.name}</h1>
      <EventForm
        weddingId={wedding.id}
        timezone={wedding.timezone}
        event={event}
        defaultDate={wedding.primaryDate}
      />
    </div>
  );
}
