import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { FormFallback } from "@/components/auth/form-fallback";
import { GuestRsvpForm } from "@/components/guests/guest-rsvp-form";
import { ArchCard } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { formatEventDay, formatLongDate, formatTime } from "@/lib/dates";
import { listWeddingEvents } from "@/modules/events";
import { findHouseholdByToken, publicRsvp, rsvpClosed } from "@/modules/guests";
import { getPublicWedding } from "@/modules/weddings";

// The token is the family's key: keep it out of search engines and out of the
// Referer header sent to maps and calendar sites (next.config.ts sets no-referrer).
export const metadata: Metadata = {
  title: "You're invited",
  robots: { index: false, follow: false },
};

export default function GuestRsvpPage({ params }: PageProps<"/r/[token]">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[30rem] flex-col px-4 py-10">
      <Logo className="mb-8 self-center" />
      <Suspense fallback={<FormFallback fields={3} />}>
        <GuestRsvp params={params} />
      </Suspense>
    </main>
  );
}

async function GuestRsvp({ params }: { params: Promise<{ token: string }> }) {
  // The deadline is checked against today's date, so this renders per request.
  await connection();
  const { token } = await params;
  const household = await findHouseholdByToken(token);
  const wedding = household ? await getPublicWedding(household.weddingId) : null;

  if (!household || !wedding) {
    return (
      <ArchCard className="space-y-4">
        <h1 className="font-serif text-[2rem] leading-tight tracking-tight">
          This link isn&apos;t working
        </h1>
        <p className="text-ink-muted">
          It may have been replaced by a newer one. Please ask the family who invited you to send
          the link again.
        </p>
      </ArchCard>
    );
  }

  const [allEvents, rsvp] = await Promise.all([
    listWeddingEvents(wedding.id),
    publicRsvp(household),
  ]);
  const events = allEvents.filter((e) => household.invitedEventIds.includes(e.id));
  const coupleNames = `${wedding.brideName} & ${wedding.groomName}`;
  const closed = rsvpClosed(wedding);

  return (
    <div className="space-y-6">
      <ArchCard className="space-y-2 text-center">
        <p className="text-emerald text-xs font-semibold tracking-[0.2em] uppercase">
          {formatLongDate(wedding.primaryDate)} · {wedding.city}
        </p>
        <h1 className="font-serif text-[2.25rem] leading-tight tracking-tight">{coupleNames}</h1>
        <p className="text-ink-muted">
          Dear {rsvp.householdName}
          {rsvp.guestNames.length ? ` (${rsvp.guestNames.join(", ")})` : ""}, you&apos;re invited
          {rsvp.maxHeadcount > 1 ? `, up to ${String(rsvp.maxHeadcount)} of you` : ""}.
        </p>
        {wedding.rsvpDeadline && !closed ? (
          <p className="text-sm">Kindly reply by {formatLongDate(wedding.rsvpDeadline)}.</p>
        ) : null}
      </ArchCard>

      {events.length === 0 ? (
        <p className="text-ink-muted text-center">
          The family is still finalising the functions. Please check back soon.
        </p>
      ) : (
        <GuestRsvpForm
          token={token}
          coupleNames={coupleNames}
          maxHeadcount={rsvp.maxHeadcount}
          initial={rsvp.answers}
          closed={closed}
          events={events.map((e) => ({
            id: e.id,
            name: e.name,
            startAt: e.startAt,
            endAt: e.endAt,
            when: `${formatEventDay(e.startAt, wedding.timezone)} · ${formatTime(e.startAt, wedding.timezone)}`,
            venueName: e.venue.name,
            venueAddress: e.venue.address,
            mapUrl: e.venue.mapUrl,
            dressCode: e.dressCode,
          }))}
        />
      )}

      <p className="text-ink-muted text-center text-xs leading-relaxed">
        Your reply is shared only with the families planning this wedding. No sign-in needed; this
        link is just for your family, so please don&apos;t forward it.
      </p>
    </div>
  );
}
