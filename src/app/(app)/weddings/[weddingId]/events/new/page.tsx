import type { Metadata } from "next";
import { Suspense } from "react";

import { loadWedding } from "@/app/(app)/weddings/[weddingId]/load";
import { FormFallback } from "@/components/auth/form-fallback";
import { EventForm } from "@/components/events/event-form";

export const metadata: Metadata = { title: "Add an event" };

export default function NewEventPage({ params }: PageProps<"/weddings/[weddingId]/events/new">) {
  return (
    <Suspense fallback={<FormFallback fields={6} />}>
      <NewEvent params={params} />
    </Suspense>
  );
}

async function NewEvent({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { wedding } = await loadWedding(
    weddingId,
    `/weddings/${weddingId}/events/new`,
    "events.edit",
  );
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-[2rem] leading-tight tracking-tight">Add an event</h1>
      <EventForm
        weddingId={wedding.id}
        timezone={wedding.timezone}
        defaultDate={wedding.primaryDate}
      />
    </div>
  );
}
