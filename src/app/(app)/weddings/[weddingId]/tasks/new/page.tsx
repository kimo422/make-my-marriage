import type { Metadata } from "next";
import { Suspense } from "react";

import { loadWedding } from "@/app/(app)/weddings/[weddingId]/load";
import { FormFallback } from "@/components/auth/form-fallback";
import { TaskForm } from "@/components/tasks/task-form";
import { listWeddingEvents } from "@/modules/events";
import { listMembers } from "@/modules/members";

export const metadata: Metadata = { title: "Add a task" };

export default function NewTaskPage({
  params,
  searchParams,
}: PageProps<"/weddings/[weddingId]/tasks/new">) {
  return (
    <Suspense fallback={<FormFallback fields={5} />}>
      <NewTask params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function NewTask({
  params,
  searchParams,
}: {
  params: Promise<{ weddingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { weddingId } = await params;
  const { event } = await searchParams;
  const { wedding } = await loadWedding(
    weddingId,
    `/weddings/${weddingId}/tasks/new`,
    "tasks.edit",
  );
  const [members, events] = await Promise.all([
    listMembers(wedding.id),
    listWeddingEvents(wedding.id),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-[2rem] leading-tight tracking-tight">Add a task</h1>
      <TaskForm
        weddingId={wedding.id}
        members={members.map((m) => ({ value: m.userId, label: m.name }))}
        events={events.map((e) => ({ value: e.id, label: e.name }))}
        defaultEventId={typeof event === "string" ? event : undefined}
      />
    </div>
  );
}
