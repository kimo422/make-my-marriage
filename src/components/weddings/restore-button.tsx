"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/api-client";

export function RestoreWeddingButton({ weddingId }: { weddingId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setPending(true);
          api("POST", `/api/weddings/${weddingId}/restore`)
            .then(() => {
              router.push(`/weddings/${weddingId}`);
              router.refresh();
            })
            .catch((e: unknown) => {
              setError(e instanceof Error ? e.message : "Couldn't restore it.");
              setPending(false);
            });
        }}
        className="border-hairline bg-field hover:bg-stone h-10 rounded-full border px-4 text-sm font-medium"
      >
        {pending ? "Restoring…" : "Restore"}
      </button>
      {error ? <p className="text-danger text-sm">{error}</p> : null}
    </div>
  );
}
