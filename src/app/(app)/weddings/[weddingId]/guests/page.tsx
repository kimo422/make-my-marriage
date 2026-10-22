import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { loadWedding } from "@/app/(app)/weddings/[weddingId]/load";
import { FormFallback } from "@/components/auth/form-fallback";
import { GuestList } from "@/components/guests/guest-list";
import { listWeddingEvents } from "@/modules/events";
import { listHouseholds } from "@/modules/guests";
import { can, SIDE_LABELS } from "@/modules/members";

export const metadata: Metadata = { title: "Guests" };

export default function GuestsPage({ params }: PageProps<"/weddings/[weddingId]/guests">) {
  return (
    <Suspense fallback={<FormFallback fields={4} />}>
      <Guests params={params} />
    </Suspense>
  );
}

const secondaryLink =
  "border-hairline bg-field text-ink hover:bg-stone inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap";

async function Guests({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const ctx = await loadWedding(weddingId, `/weddings/${weddingId}/guests`, "rsvps.view");
  const { wedding, membership } = ctx;
  const [households, events] = await Promise.all([
    listHouseholds(ctx),
    listWeddingEvents(wedding.id),
  ]);
  const canEdit = can(membership.role, "guests.edit");
  const oneSide = membership.role === "organizer" && membership.side !== "both";
  const base = `/weddings/${wedding.id}/guests`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[2rem] leading-tight tracking-tight">Guests</h1>
          <p className="text-ink-muted mt-1">
            {oneSide
              ? `${SIDE_LABELS[membership.side]}: the families you look after.`
              : "Every family you're inviting."}
          </p>
        </div>
        {canEdit ? (
          <Link
            href={`${base}/new`}
            className="bg-emerald text-ivory hover:bg-emerald-hover inline-flex h-11 shrink-0 items-center rounded-full px-5 font-medium"
          >
            Add family
          </Link>
        ) : null}
      </div>
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Link href={`${base}/invites`} className={secondaryLink}>
            Send invites on WhatsApp
          </Link>
          <Link href={`${base}/import`} className={secondaryLink}>
            Import a spreadsheet
          </Link>
          <Link href={`${base}/templates`} className={secondaryLink}>
            Message wording
          </Link>
        </div>
      ) : null}
      <GuestList
        weddingId={wedding.id}
        households={households}
        events={events.map((e) => ({ id: e.id, name: e.name }))}
        showSideFilter={!oneSide}
      />
      {!can(membership.role, "guests.viewContacts") ? (
        <p className="text-ink-muted text-center text-sm">
          Phone numbers and emails are visible to the planning team only.
        </p>
      ) : null}
    </div>
  );
}
