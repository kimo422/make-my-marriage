import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { loadWedding } from "@/app/(app)/weddings/[weddingId]/load";
import { FormFallback } from "@/components/auth/form-fallback";
import { ChecklistImport } from "@/components/tasks/checklist-import";
import { cn } from "@/lib/cn";
import { addDays, todayIn, utcToZoned } from "@/lib/dates";
import { listWeddingEvents } from "@/modules/events";
import { checklistFor } from "@/modules/tasks";

export const metadata: Metadata = { title: "Starter checklists" };

export default function ChecklistsPage({
  params,
  searchParams,
}: PageProps<"/weddings/[weddingId]/tasks/checklists">) {
  return (
    <Suspense fallback={<FormFallback fields={4} />}>
      <Checklists params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Checklists({
  params,
  searchParams,
}: {
  params: Promise<{ weddingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { weddingId } = await params;
  const { event: eventParam } = await searchParams;
  const { wedding } = await loadWedding(
    weddingId,
    `/weddings/${weddingId}/tasks/checklists`,
    "tasks.edit",
  );
  const events = await listWeddingEvents(wedding.id);
  const selected = events.find((e) => e.id === eventParam) ?? null;

  // Same rule as the API: count back from the event's day, or the main wedding date.
  const date = selected ? utcToZoned(selected.startAt, wedding.timezone).date : wedding.primaryDate;
  const today = todayIn(wedding.timezone);
  const items = checklistFor(selected?.type ?? null).map((item) => {
    const due = addDays(date, -item.daysBefore);
    return {
      id: item.id,
      title: item.title,
      priority: item.priority,
      dueAt: due < today ? today : due,
    };
  });
  const base = `/weddings/${wedding.id}/tasks/checklists`;
  const tab = (active: boolean) =>
    cn(
      "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium whitespace-nowrap",
      active ? "bg-emerald text-ivory" : "border-hairline border bg-white hover:bg-stone",
    );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-[2rem] leading-tight tracking-tight">Starter checklists</h1>
        <p className="text-ink-muted mt-1">
          Pick a list, untick what you don&apos;t need, and add the rest as tasks.
        </p>
      </div>
      <nav aria-label="Checklist" className="-mx-4 flex gap-2 overflow-x-auto px-4">
        <Link href={base} className={tab(!selected)} aria-current={!selected ? "page" : undefined}>
          The whole wedding
        </Link>
        {events.map((e) => (
          <Link
            key={e.id}
            href={`${base}?event=${e.id}`}
            className={tab(selected?.id === e.id)}
            aria-current={selected?.id === e.id ? "page" : undefined}
          >
            {e.name}
          </Link>
        ))}
      </nav>
      <ChecklistImport
        key={selected?.id ?? "general"}
        weddingId={wedding.id}
        eventId={selected?.id ?? null}
        targetName={selected?.name ?? "the wedding"}
        items={items}
      />
    </div>
  );
}
