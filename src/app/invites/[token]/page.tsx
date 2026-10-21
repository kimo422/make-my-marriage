import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { FormFallback } from "@/components/auth/form-fallback";
import { AcceptInvite } from "@/components/members/accept-invite";
import { ArchCard } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Logo } from "@/components/ui/logo";
import { getOptionalUser } from "@/lib/auth/session";
import { formatLongDate } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { ROLE_LABELS, SIDE_LABELS } from "@/modules/members";
import { previewInvite, type InvitePreviewDto } from "@/modules/weddings";

export const metadata: Metadata = { title: "You're invited to help plan" };

export default function InvitePage({ params }: PageProps<"/invites/[token]">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col justify-center px-4 py-10">
      <Logo className="mb-8 self-center" />
      <Suspense fallback={<FormFallback />}>
        <Invite params={params} />
      </Suspense>
    </main>
  );
}

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  // Expiry is checked against the current time, so this always renders per request.
  await connection();
  const { token } = await params;
  let invite: InvitePreviewDto | null = null;
  try {
    invite = await previewInvite(token);
  } catch (error) {
    if (!(error instanceof AppError) || error.status !== 404) throw error;
  }

  if (!invite) {
    return (
      <ArchCard className="space-y-4">
        <h1 className="font-serif text-[2rem] leading-tight tracking-tight">
          This invite link isn&apos;t valid
        </h1>
        <p className="text-ink-muted">
          It may have expired, been used already, or been replaced by a newer link. Ask the person
          who invited you to send a new one.
        </p>
      </ArchCard>
    );
  }

  const user = await getOptionalUser();
  const back = encodeURIComponent(`/invites/${token}`);

  return (
    <ArchCard className="space-y-6">
      <div className="space-y-2">
        <p className="text-emerald text-xs font-semibold tracking-[0.2em] uppercase">
          You&apos;re invited to help plan
        </p>
        <h1 className="font-serif text-[2rem] leading-tight tracking-tight">
          {invite.brideName} &amp; {invite.groomName}
        </h1>
        <p className="text-ink-muted">
          {formatLongDate(invite.primaryDate)} · {invite.city}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Chip tone="blush">{ROLE_LABELS[invite.role]}</Chip>
          {invite.side !== "both" ? <Chip>{SIDE_LABELS[invite.side]}</Chip> : null}
        </div>
      </div>

      {user ? (
        <AcceptInvite token={token} signedInAs={user.email} />
      ) : (
        <div className="space-y-3">
          <p className="text-ink-muted text-sm">
            Create an account or sign in with the email address this invite was sent to.
          </p>
          <Link
            href={`/sign-up?next=${back}`}
            className="bg-emerald text-ivory hover:bg-emerald-hover inline-flex h-12 w-full items-center justify-center rounded-full font-medium"
          >
            Create an account
          </Link>
          <Link
            href={`/sign-in?next=${back}`}
            className="border-hairline bg-field hover:bg-stone inline-flex h-12 w-full items-center justify-center rounded-full border font-medium"
          >
            I already have an account
          </Link>
        </div>
      )}
    </ArchCard>
  );
}
