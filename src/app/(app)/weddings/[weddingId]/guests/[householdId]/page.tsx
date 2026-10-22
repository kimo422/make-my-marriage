import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { loadWedding } from "@/app/(app)/weddings/[weddingId]/load";
import { FormFallback } from "@/components/auth/form-fallback";
import { DeleteHousehold, GuestRows } from "@/components/guests/guest-rows";
import { HouseholdForm } from "@/components/guests/household-form";
import { InviteActions } from "@/components/guests/invite-actions";
import { RsvpAnswers } from "@/components/guests/rsvp-answers";
import { formatEventDay, formatTime } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { listWeddingEvents } from "@/modules/events";
import { getHousehold, HOUSEHOLD_SIDE_LABELS, type HouseholdDto } from "@/modules/guests";
import { can } from "@/modules/members";
import type { WeddingContext } from "@/modules/weddings";

export const metadata: Metadata = { title: "Family" };

export default function HouseholdPage({
  params,
}: PageProps<"/weddings/[weddingId]/guests/[householdId]">) {
  return (
    <Suspense fallback={<FormFallback fields={5} />}>
      <Household params={params} />
    </Suspense>
  );
}

async function load(ctx: WeddingContext, householdId: string): Promise<HouseholdDto> {
  try {
    return await getHousehold(ctx, householdId);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}

async function Household({
  params,
}: {
  params: Promise<{ weddingId: string; householdId: string }>;
}) {
  const { weddingId, householdId } = await params;
  const ctx = await loadWedding(
    weddingId,
    `/weddings/${weddingId}/guests/${householdId}`,
    "rsvps.view",
  );
  const { wedding, membership } = ctx;
  const [household, allEvents] = await Promise.all([
    load(ctx, householdId),
    listWeddingEvents(wedding.id),
  ]);
  const canEdit = can(membership.role, "guests.edit");
  const events = allEvents.map((e) => ({
    id: e.id,
    name: e.name,
    when: `${formatEventDay(e.startAt, wedding.timezone)} · ${formatTime(e.startAt, wedding.timezone)}`,
  }));
  const fixedSide =
    membership.role === "organizer" && membership.side !== "both" ? membership.side : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/weddings/${wedding.id}/guests`} className="text-emerald text-sm font-medium">
          ← Guests
        </Link>
        <h1 className="mt-2 font-serif text-[2rem] leading-tight tracking-tight">
          {household.name}
        </h1>
        <p className="text-ink-muted mt-1">
          {HOUSEHOLD_SIDE_LABELS[household.side]}
          {household.group ? ` · ${household.group}` : ""} · up to {household.maxHeadcount}
        </p>
      </div>

      {canEdit ? (
        <section className="border-hairline rounded-card space-y-3 border bg-white p-6">
          <h2 className="font-serif text-xl">Invitation</h2>
          <InviteActions weddingId={wedding.id} household={household} />
        </section>
      ) : null}

      <section className="border-hairline rounded-card space-y-2 border bg-white p-6">
        <h2 className="font-serif text-xl">Answers</h2>
        <RsvpAnswers
          weddingId={wedding.id}
          household={household}
          events={events}
          canEdit={canEdit}
        />
      </section>

      <section className="border-hairline rounded-card space-y-2 border bg-white p-6">
        <h2 className="font-serif text-xl">Guests</h2>
        <GuestRows
          weddingId={wedding.id}
          householdId={household.id}
          primaryGuestId={household.primaryGuestId}
          guests={household.guests}
          canEdit={canEdit}
        />
      </section>

      {canEdit ? (
        <>
          <section className="space-y-3">
            <h2 className="font-serif text-xl">Family details</h2>
            <HouseholdForm
              weddingId={wedding.id}
              events={events}
              household={household}
              fixedSide={fixedSide}
            />
          </section>
          <DeleteHousehold
            weddingId={wedding.id}
            householdId={household.id}
            name={household.name}
          />
        </>
      ) : household.notes ? (
        <section className="border-hairline rounded-card border bg-white p-6">
          <h2 className="font-serif text-xl">Notes</h2>
          <p className="mt-2 whitespace-pre-line">{household.notes}</p>
        </section>
      ) : null}
    </div>
  );
}
