import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { loadWedding } from "@/app/(app)/weddings/[weddingId]/load";
import { FormFallback } from "@/components/auth/form-fallback";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskFilters } from "@/components/tasks/task-filters";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";
import { formatLongDate } from "@/lib/dates";
import { objectId } from "@/lib/validation/common";
import { listWeddingEvents } from "@/modules/events";
import { can, listMembers } from "@/modules/members";
import { listWeddingTasks } from "@/modules/tasks";
import { STATUS_LABELS } from "@/modules/tasks/schema";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage({
  params,
  searchParams,
}: PageProps<"/weddings/[weddingId]/tasks">) {
  return (
    <Suspense fallback={<FormFallback fields={4} />}>
      <Tasks params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const validId = (v: string | undefined) => (v && objectId.safeParse(v).success ? v : undefined);

async function Tasks({
  params,
  searchParams,
}: {
  params: Promise<{ weddingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { weddingId } = await params;
  const query = await searchParams;
  const ctx = await loadWedding(weddingId, `/weddings/${weddingId}/tasks`);
  const { wedding, membership } = ctx;
  const canEdit = can(membership.role, "tasks.edit");

  const assignee = pick(query.assignee);
  const view = pick(query.view) === "list" ? "list" : "board";
  const [tasks, members, events] = await Promise.all([
    listWeddingTasks(ctx, {
      assigneeId: assignee === "me" ? "me" : validId(assignee),
      eventId: validId(pick(query.event)),
      overdue: pick(query.overdue) === "true" ? "true" : undefined,
    }),
    listMembers(wedding.id),
    listWeddingEvents(wedding.id),
  ]);
  const memberNames = Object.fromEntries(members.map((m) => [m.userId, m.name]));
  const eventNames = Object.fromEntries(events.map((e) => [e.id, e.name]));
  const memberOptions = members.map((m) => ({ value: m.userId, label: m.name }));
  const eventOptions = events.map((e) => ({ value: e.id, label: e.name }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-[2rem] leading-tight tracking-tight">Tasks</h1>
          <p className="text-ink-muted mt-1">
            {tasks.filter((t) => t.status !== "done").length} open ·{" "}
            {tasks.filter((t) => t.overdue).length} overdue
          </p>
        </div>
        {canEdit ? (
          <div className="flex gap-2">
            <Link
              href={`/weddings/${wedding.id}/tasks/checklists`}
              className="border-hairline hover:bg-stone inline-flex h-11 items-center rounded-full border bg-white px-4 text-sm font-medium"
            >
              Starter checklists
            </Link>
            <Link
              href={`/weddings/${wedding.id}/tasks/new`}
              className="bg-emerald text-ivory hover:bg-emerald-hover inline-flex h-11 items-center rounded-full px-5 font-medium"
            >
              Add task
            </Link>
          </div>
        ) : null}
      </div>

      <TaskFilters members={memberOptions} events={eventOptions} />

      {view === "board" ? (
        <TaskBoard
          weddingId={wedding.id}
          tasks={tasks}
          memberNames={memberNames}
          eventNames={eventNames}
          canEdit={canEdit}
        />
      ) : tasks.length === 0 ? (
        <p className="text-ink-muted border-hairline rounded-card border bg-white p-6 text-center">
          No tasks match.
        </p>
      ) : (
        <ul className="divide-hairline border-hairline rounded-card divide-y border bg-white">
          {[...tasks]
            .sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"))
            .map((t) => (
              <li key={t.id}>
                <Link
                  href={`/weddings/${wedding.id}/tasks/${t.id}`}
                  className="hover:bg-stone/50 flex items-center gap-3 px-4 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate font-medium",
                        t.status === "done" && "text-ink-muted line-through",
                      )}
                    >
                      {t.title}
                    </span>
                    <span className="text-ink-muted block truncate text-sm">
                      {[
                        t.assigneeId
                          ? (memberNames[t.assigneeId] ?? "Former member")
                          : "Unassigned",
                        t.eventId ? eventNames[t.eventId] : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <Chip tone={t.status === "done" ? "soft" : "stone"}>
                      {STATUS_LABELS[t.status]}
                    </Chip>
                    {t.dueAt ? (
                      <span
                        className={cn(
                          "text-xs",
                          t.overdue ? "text-danger font-semibold" : "text-ink-muted",
                        )}
                      >
                        {formatLongDate(t.dueAt)}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
