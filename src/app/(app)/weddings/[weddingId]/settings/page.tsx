import type { Metadata } from "next";
import { Suspense } from "react";

import { FormFallback } from "@/components/auth/form-fallback";
import { DeleteWedding } from "@/components/weddings/delete-wedding";
import { EditWeddingForm } from "@/components/weddings/edit-wedding-form";
import { InviteCardPanel } from "@/components/website/invite-card-panel";
import { WebsiteSettings } from "@/components/website/website-settings";
import { env } from "@/lib/env/server";
import { can } from "@/modules/members";
import { getWebsiteSettings, RESTORE_WINDOW_DAYS } from "@/modules/weddings";

import { loadWedding } from "@/app/(app)/weddings/[weddingId]/load";

export const metadata: Metadata = { title: "Wedding settings" };

export default function SettingsPage({ params }: PageProps<"/weddings/[weddingId]/settings">) {
  return (
    <Suspense fallback={<FormFallback fields={5} />}>
      <Settings params={params} />
    </Suspense>
  );
}

async function Settings({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const ctx = await loadWedding(weddingId, `/weddings/${weddingId}/settings`, "wedding.edit");
  const { wedding, membership } = ctx;
  const website = await getWebsiteSettings(ctx);
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-[2rem] leading-tight tracking-tight">Wedding settings</h1>
      <EditWeddingForm wedding={wedding} siteHost={new URL(env.APP_URL).host} />
      {can(membership.role, "website.edit") ? (
        <WebsiteSettings weddingId={wedding.id} settings={website} />
      ) : null}
      <InviteCardPanel weddingId={wedding.id} slug={wedding.slug} />
      {can(membership.role, "wedding.delete") ? (
        <DeleteWedding
          weddingId={wedding.id}
          slug={wedding.slug}
          restoreDays={RESTORE_WINDOW_DAYS}
        />
      ) : null}
    </div>
  );
}
