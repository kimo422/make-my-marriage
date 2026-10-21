"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { api, ApiClientError } from "@/lib/api-client";

export function AcceptInvite({ token, signedInAs }: { token: string; signedInAs: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; weddingId?: string } | null>(null);

  return (
    <div className="space-y-4">
      {error ? (
        <FormAlert>
          {error.message}{" "}
          {error.weddingId ? (
            <Link href={`/weddings/${error.weddingId}`} className="underline underline-offset-2">
              Open the wedding
            </Link>
          ) : null}
        </FormAlert>
      ) : null}
      <Button
        disabled={pending}
        onClick={() => {
          setPending(true);
          setError(null);
          api<{ weddingId: string }>("POST", "/api/invites/accept", { token })
            .then(({ weddingId }) => {
              router.replace(`/weddings/${weddingId}`);
              router.refresh();
            })
            .catch((e: unknown) => {
              const details =
                e instanceof ApiClientError
                  ? (e.details as { weddingId?: string } | undefined)
                  : undefined;
              setError({
                message: e instanceof Error ? e.message : "Couldn't accept the invite.",
                ...(details?.weddingId ? { weddingId: details.weddingId } : {}),
              });
              setPending(false);
            });
        }}
      >
        {pending ? "Joining…" : "Accept and join"}
      </Button>
      <p className="text-ink-muted text-center text-sm">Signed in as {signedInAs}</p>
    </div>
  );
}
