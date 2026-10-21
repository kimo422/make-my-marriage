import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { loadWedding } from "@/app/(app)/weddings/[weddingId]/load";
import { FormFallback } from "@/components/auth/form-fallback";
import { TaskForm } from "@/components/tasks/task-form";
import { Chip } from "@/components/ui/chip";
import { AppError } from "@/lib/errors";
import { formatLongDate } from "@/lib/dates";
import { listWeddingEvents } from "@/modules/events";
import { can, listMembers } from "@/modules/members";
import { getTask, type TaskDto } from "@/modules/tasks";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/modules/tasks/schema";

export const metadata: Metadata = { title: "Task" };

export default function TaskPage({ params }: PageProps<"/weddings/[weddingId]/tasks/[taskId]">) {
  return (
    <Suspense fallback={<FormFallback fields={5} />}>
      <Task params={params} />
    </Suspense>
  );
}

async function Task({ params }: { params: Promise<{ weddingId: string; taskId: string }> }) {
  const { weddingId, taskId } = await params;
  const ctx = await loadWedding(weddingId, `/weddings/${weddingId}/tasks/${taskId}`);
  let task: TaskDto;
  try {
    task = await getTask(ctx, taskId);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  const [members, events] = await Promise.all([
    listMembers(ctx.wedding.id),
    listWeddingEvents(ctx.wedding.id),
  ]);
  const memberOptions = members.map((m) => ({ value: m.userId, label: m.name }));
  const eventOptions = events.map((e) => ({ value: e.id, label: e.name }));

  if (!can(ctx.membership.role, "tasks.edit")) {
    // Viewers get a read-only card.
    const assignee = members.find((m) => m.userId === task.assigneeId)?.name;
    const event = events.find((e) => e.id === task.eventId)?.name;
    return (
      <article className="border-hairline rounded-card space-y-3 border bg-white p-6">
        <h1 className="font-serif text-[2rem] leading-tight tracking-tight">{task.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Chip>{STATUS_LABELS[task.status]}</Chip>
          <Chip>{PRIORITY_LABELS[task.priority]} priority</Chip>
        </div>
        {task.description ? <p className="whitespace-pre-line">{task.description}</p> : null}
        <p className="text-ink-muted text-sm">
          {[
            assignee ? `Assigned to ${assignee}` : "Unassigned",
            event,
            task.dueAt ? `Due ${formatLongDate(task.dueAt)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </article>
    );
  }

  const canDelete = can(ctx.membership.role, "events.edit") || task.createdBy === ctx.user.id;
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-[2rem] leading-tight tracking-tight">Edit task</h1>
      <TaskForm
        weddingId={ctx.wedding.id}
        task={task}
        members={memberOptions}
        events={eventOptions}
        canDelete={canDelete}
      />
    </div>
  );
}
