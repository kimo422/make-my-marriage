"use client";

import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { ArchCard } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/form-alert";

const noSubscription = () => () => undefined;

/**
 * The invite card image (FR-7.5): preview, download, and on phones the share
 * sheet, so it can be sent on WhatsApp next to each family's message.
 */
export function InviteCardPanel({ weddingId, slug }: { weddingId: string; slug: string }) {
  const src = `/api/weddings/${weddingId}/invite-card`;
  const filename = `invite-${slug}.png`;
  const [error, setError] = useState<string | null>(null);
  // Known only in the browser; the server renders without the Share button.
  const canShare = useSyncExternalStore(
    noSubscription,
    () => "canShare" in navigator,
    () => false,
  );

  async function share() {
    setError(null);
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
      else setError("Your browser can't share images. Use Download instead.");
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError") setError("Couldn't share the card.");
    }
  }

  return (
    <ArchCard className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl">Invite card</h2>
        <p className="text-ink-muted text-sm">
          Made from your names, date and city. Send it on WhatsApp with each family&apos;s message;
          it also appears when the website link is shared.
        </p>
      </div>
      {error ? <FormAlert>{error}</FormAlert> : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- a generated PNG; next/image adds nothing here */}
      <img
        src={src}
        alt="Your invite card"
        width={1080}
        height={1350}
        className="border-hairline mx-auto h-auto w-full max-w-xs rounded-xl border"
      />
      <div className="flex flex-wrap gap-2">
        <a
          href={src}
          download={filename}
          className="bg-emerald text-ivory hover:bg-emerald-hover inline-flex h-11 items-center rounded-full px-5 font-medium"
        >
          Download
        </a>
        {canShare ? (
          <Button
            variant="secondary"
            className="h-11 w-auto"
            onClick={() => {
              void share();
            }}
          >
            Share
          </Button>
        ) : null}
      </div>
    </ArchCard>
  );
}
