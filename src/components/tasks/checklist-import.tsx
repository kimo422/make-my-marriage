"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { api } from "@/lib/api-client";
import { formatLongDate } from "@/lib/dates";
import { PRIORITY_LABELS } from "@/modules/tasks/schema";

interface Item {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
  dueAt: string;
}

export function ChecklistImport({
  weddingId,
  eventId,
  targetName,
  items,
}: {
  weddingId: string;
  eventId: string | null;
  targetName: string;
  items: Item[];
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(() => new Set(items.map((i) => i.id)));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <p className="border-hairline rounded-card text-ink-muted border bg-white p-6 text-center">
        There&apos;s no starter checklist for custom events. Try the whole-wedding list, or add
        tasks yourself.
      </p>
    );
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <ul className="divide-hairline border-hairline rounded-card divide-y border bg-white">
        {items.map((item) => (
          <li key={item.id}>
            <label className="hover:bg-stone/40 flex cursor-pointer items-start gap-3 px-4 py-3">
              <input
                type="checkbox"
                checked={picked.has(item.id)}
                onChange={() => {
                  toggle(item.id);
                }}
                className="accent-emerald mt-1 size-5 shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block">{item.title}</span>
                <span className="text-ink-muted block text-sm">
                  Due {formatLongDate(item.dueAt)} · {PRIORITY_LABELS[item.priority]} priority
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {error ? <FormAlert>{error}</FormAlert> : null}
      <Button
        disabled={pending || picked.size === 0}
        onClick={() => {
          setPending(true);
          setError(null);
          api("POST", `/api/weddings/${weddingId}/tasks/import-checklist`, {
            eventId,
            itemIds: [...picked],
          })
            .then(() => {
              router.push(`/weddings/${weddingId}/tasks`);
              router.refresh();
            })
            .catch((e: unknown) => {
              setError(e instanceof Error ? e.message : "Couldn't import the checklist.");
              setPending(false);
            });
        }}
      >
        {pending ? "Adding…" : `Add ${String(picked.size)} tasks for ${targetName}`}
      </Button>
      <p className="text-ink-muted text-center text-sm">
        They become normal tasks you can edit, assign or delete. Dates already past are set to
        today.
      </p>
    </div>
  );
}
