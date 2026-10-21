"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type DragEvent } from "react";

import { Avatar } from "@/components/ui/avatar";
import { api, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatLongDate } from "@/lib/dates";
import { STATUS_LABELS, TASK_STATUSES, type TaskStatus } from "@/modules/tasks/schema";
import type { TaskDto } from "@/modules/tasks/types";

interface Props {
  weddingId: string;
  tasks: TaskDto[];
  memberNames: Record<string, string>;
  eventNames: Record<string, string>;
  canEdit: boolean;
}

/** Board by status (FR-5.2). Buttons move cards everywhere; drag-and-drop adds speed on a computer. */
export function TaskBoard({ weddingId, tasks, memberNames, eventNames, canEdit }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const columns = Object.fromEntries(
    TASK_STATUSES.map((s) => [s, tasks.filter((t) => t.status === s)]),
  ) as Record<TaskStatus, TaskDto[]>;

  function move(
    task: TaskDto,
    status: TaskStatus,
    beforeId: string | null,
    afterId: string | null,
  ) {
    setBusy(task.id);
    setError(null);
    api(
      "POST",
      `/api/weddings/${weddingId}/tasks/${task.id}/move`,
      { status, beforeId, afterId },
      { ifMatch: task.updatedAt },
    )
      .then(() => {
        router.refresh();
      })
      .catch((e: unknown) => {
        setError(
          e instanceof ApiClientError && e.status === 409
            ? "Someone else just changed that task. The board has been refreshed."
            : e instanceof Error
              ? e.message
              : "Couldn't move the task.",
        );
        router.refresh();
      })
      .finally(() => {
        setBusy(null);
      });
  }

  /** Puts `task` directly above `target` (or at the bottom of `status` when target is null). */
  function placeBefore(task: TaskDto, status: TaskStatus, target: TaskDto | null) {
    const column = columns[status].filter((t) => t.id !== task.id);
    if (!target) {
      move(task, status, column.at(-1)?.id ?? null, null);
      return;
    }
    const i = column.findIndex((t) => t.id === target.id);
    move(task, status, column[i - 1]?.id ?? null, target.id);
  }

  function onDrop(e: DragEvent, status: TaskStatus, target: TaskDto | null) {
    e.preventDefault();
    e.stopPropagation();
    const task = tasks.find((t) => t.id === dragging);
    setDragging(null);
    if (task && task.id !== target?.id) placeBefore(task, status, target);
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:grid md:grid-cols-3 md:overflow-visible">
        {TASK_STATUSES.map((status) => (
          <section
            key={status}
            aria-label={STATUS_LABELS[status]}
            onDragOver={
              canEdit
                ? (e) => {
                    e.preventDefault();
                  }
                : undefined
            }
            onDrop={
              canEdit
                ? (e) => {
                    onDrop(e, status, null);
                  }
                : undefined
            }
            className="bg-stone/60 rounded-card w-[85%] shrink-0 snap-start p-3 md:w-auto"
          >
            <h2 className="flex items-center justify-between px-1 pb-2 text-sm font-semibold">
              {STATUS_LABELS[status]}
              <span className="text-ink-muted font-normal">{columns[status].length}</span>
            </h2>
            <ol className="min-h-16 space-y-2">
              {columns[status].map((task, i, col) => (
                <li
                  key={task.id}
                  draggable={canEdit}
                  onDragStart={() => {
                    setDragging(task.id);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                  }}
                  onDragOver={
                    canEdit
                      ? (e) => {
                          e.preventDefault();
                        }
                      : undefined
                  }
                  onDrop={
                    canEdit
                      ? (e) => {
                          onDrop(e, status, task);
                        }
                      : undefined
                  }
                  className={cn(
                    "border-hairline rounded-field border bg-white p-3",
                    dragging === task.id && "opacity-50",
                    busy === task.id && "animate-pulse",
                  )}
                >
                  <Link
                    href={`/weddings/${weddingId}/tasks/${task.id}`}
                    className="block font-medium hover:underline"
                  >
                    {task.title}
                  </Link>
                  <div className="text-ink-muted mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {task.assigneeId ? (
                      <span className="flex items-center gap-1.5">
                        <Avatar
                          name={memberNames[task.assigneeId] ?? "?"}
                          className="size-6 text-[0.65rem]"
                        />
                        {memberNames[task.assigneeId] ?? "Former member"}
                      </span>
                    ) : null}
                    {task.dueAt ? (
                      <span className={cn(task.overdue && "text-danger font-semibold")}>
                        {task.overdue ? "Overdue · " : "Due "}
                        {formatLongDate(task.dueAt)}
                      </span>
                    ) : null}
                    {task.eventId && eventNames[task.eventId] ? (
                      <span>{eventNames[task.eventId]}</span>
                    ) : null}
                    {task.priority === "high" ? (
                      <span className="text-ink font-semibold">High priority</span>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <div className="mt-2 flex items-center gap-1">
                      <label className="sr-only" htmlFor={`status-${task.id}`}>
                        Move {task.title} to
                      </label>
                      <select
                        id={`status-${task.id}`}
                        value={status}
                        disabled={busy === task.id}
                        onChange={(e) => {
                          placeBefore(task, e.target.value as TaskStatus, null);
                        }}
                        className="border-hairline bg-field rounded-full border px-2 py-1 text-xs"
                      >
                        {TASK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        aria-label={`Move ${task.title} up`}
                        disabled={busy === task.id || i === 0}
                        onClick={() => {
                          move(task, status, col[i - 2]?.id ?? null, col[i - 1]?.id ?? null);
                        }}
                        className="hover:bg-stone ml-auto rounded-full px-2 py-1 text-xs disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${task.title} down`}
                        disabled={busy === task.id || i === col.length - 1}
                        onClick={() => {
                          move(task, status, col[i + 1]?.id ?? null, col[i + 2]?.id ?? null);
                        }}
                        className="hover:bg-stone rounded-full px-2 py-1 text-xs disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
