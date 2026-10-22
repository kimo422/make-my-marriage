import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { loadWedding } from "@/app/(app)/weddings/[weddingId]/load";
import { FormFallback } from "@/components/auth/form-fallback";
import { TemplatesForm } from "@/components/guests/templates-form";
import { formatEventDay, formatLongDate, formatTime } from "@/lib/dates";
import { env } from "@/lib/env/server";
import { listWeddingEvents } from "@/modules/events";
import { DEFAULT_TEMPLATES, getTemplates } from "@/modules/guests";

export const metadata: Metadata = { title: "Message wording" };

export default function TemplatesPage({
  params,
}: PageProps<"/weddings/[weddingId]/guests/templates">) {
  return (
    <Suspense fallback={<FormFallback fields={3} />}>
      <TemplatesEditor params={params} />
    </Suspense>
  );
}

async function TemplatesEditor({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { wedding } = await loadWedding(
    weddingId,
    `/weddings/${weddingId}/guests/templates`,
    "guests.edit",
  );
  const [templates, events] = await Promise.all([
    getTemplates(wedding.id),
    listWeddingEvents(wedding.id),
  ]);
  const first = events[0];
  const sample = {
    householdName: "Sharma family",
    coupleNames: `${wedding.brideName} & ${wedding.groomName}`,
    rsvpUrl: `${env.APP_URL}/r/…`,
    rsvpDeadline: wedding.rsvpDeadline ? formatLongDate(wedding.rsvpDeadline) : "the earliest",
    eventName: first?.name ?? "Sangeet",
    eventDay: first ? formatEventDay(first.startAt, wedding.timezone) : "Fri, 11 Dec 2026",
    eventTime: first ? formatTime(first.startAt, wedding.timezone) : "7:00 pm",
    venue: first?.venue.name ?? "Taj Krishna, Banjara Hills",
  };
  return (
    <div className="space-y-6">
      <div>
        <Link href={`/weddings/${wedding.id}/guests`} className="text-emerald text-sm font-medium">
          ← Guests
        </Link>
        <h1 className="mt-2 font-serif text-[2rem] leading-tight tracking-tight">
          Message wording
        </h1>
        <p className="text-ink-muted mt-1">
          One set for the whole wedding. Write it in any language.
        </p>
      </div>
      <TemplatesForm
        weddingId={wedding.id}
        templates={templates}
        defaults={DEFAULT_TEMPLATES}
        sample={sample}
      />
    </div>
  );
}
