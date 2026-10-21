"use client";

import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { api } from "@/lib/api-client";

export function DeleteWedding({
  weddingId,
  slug,
  restoreDays,
}: {
  weddingId: string;
  slug: string;
  restoreDays: number;
}) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api("DELETE", `/api/weddings/${weddingId}`, { slug: typed });
      router.replace("/weddings?pick=1");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete it.");
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby="delete-heading"
      className="border-hairline rounded-card bg-stone/40 space-y-4 border p-5 sm:p-6"
    >
      <div>
        <h2 id="delete-heading" className="font-serif text-xl">
          Delete this wedding
        </h2>
        <p className="text-ink-muted mt-1 text-sm">
          It disappears for everyone straight away. You can restore it from &ldquo;Your
          weddings&rdquo; for {restoreDays} days; after that, all its data is deleted for good.
        </p>
      </div>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          void onSubmit(event);
        }}
      >
        <Field
          label={`Type ${slug} to confirm`}
          name="confirm"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={typed}
          error={error ?? undefined}
          onChange={(e) => {
            setTyped(e.target.value);
          }}
        />
        <Button type="submit" variant="secondary" disabled={pending || typed.trim() !== slug}>
          {pending ? "Deleting…" : "Delete wedding"}
        </Button>
      </form>
    </section>
  );
}
