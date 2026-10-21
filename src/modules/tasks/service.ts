import "server-only";

import type { DbSession } from "@/lib/db/connect";
import { addDays, todayIn } from "@/lib/dates";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { logActivity } from "@/modules/activity";
import type { EventType } from "@/modules/events/schema";
import { can, getMembership, type Role } from "@/modules/members";

import { checklistFor } from "./checklists";
import * as repo from "./repo";
import type {
  CreateTaskInput,
  MoveTaskInput,
  TaskQuery,
  TaskStatus,
  UpdateTaskInput,
} from "./schema";
import type { TaskCountsDto, TaskDto } from "./types";

/** What the tasks service needs to know about the caller; weddings.requireAccess() provides it. */
export interface TaskContext {
  user: { id: string; name: string };
  membership: { role: Role };
  wedding: { id: string; timezone: string; primaryDate: string };
}

const today = (ctx: TaskContext) => todayIn(ctx.wedding.timezone);

function assertCanEdit(ctx: TaskContext) {
  if (!can(ctx.membership.role, "tasks.edit")) throw forbidden();
}

async function assertAssignee(weddingId: string, assigneeId: string | null | undefined) {
  if (!assigneeId) return;
  if (!(await getMembership(weddingId, assigneeId))) {
    throw new AppError("VALIDATION_FAILED", "Assign the task to a member of this wedding", {
      fields: { assigneeId: "Choose someone on the planning team" },
    });
  }
}

function conflict(current: TaskDto): AppError {
  return new AppError("CONFLICT", "Someone else changed this task. Here's the latest version.", {
    details: current,
  });
}

function log(
  ctx: TaskContext,
  taskId: string,
  action: "created" | "updated" | "deleted",
  summary: string,
) {
  return logActivity({
    weddingId: ctx.wedding.id,
    actorId: ctx.user.id,
    actorLabel: ctx.user.name,
    action,
    entity: "task",
    entityId: taskId,
    summary,
  });
}

export function listWeddingTasks(ctx: TaskContext, query: TaskQuery): Promise<TaskDto[]> {
  const day = today(ctx);
  return repo.listTasks(
    ctx.wedding.id,
    {
      status: query.status,
      assigneeId: query.assigneeId === "me" ? ctx.user.id : query.assigneeId,
      eventId: query.eventId,
      overdueBefore: query.overdue === "true" ? day : undefined,
    },
    day,
  );
}

export async function getTask(ctx: TaskContext, taskId: string): Promise<TaskDto> {
  const task = await repo.findTask(ctx.wedding.id, taskId, today(ctx));
  if (!task) throw notFound("Task not found");
  return task;
}

/** Callers check that `input.eventId` belongs to the wedding (tasks doesn't import events). */
export async function createTask(ctx: TaskContext, input: CreateTaskInput): Promise<TaskDto> {
  assertCanEdit(ctx);
  await assertAssignee(ctx.wedding.id, input.assigneeId);
  const status = input.status ?? "todo";
  const [task] = await repo.insertTasks(
    ctx.wedding.id,
    [
      {
        title: input.title,
        description: input.description ?? null,
        status,
        priority: input.priority ?? "medium",
        assigneeId: input.assigneeId ?? null,
        eventId: input.eventId ?? null,
        dueAt: input.dueAt ?? null,
        boardOrder: (await repo.maxBoardOrder(ctx.wedding.id, status)) + 1,
        createdBy: ctx.user.id,
      },
    ],
    today(ctx),
  );
  if (!task) throw new Error("Task insert returned nothing");
  await log(ctx, task.id, "created", `${ctx.user.name} added the task "${task.title}"`);
  return task;
}

/** Status changes set or clear completedAt and move the card to the bottom of its new column. */
async function statusPatch(ctx: TaskContext, from: TaskStatus, to: TaskStatus | undefined) {
  if (!to || to === from) return {};
  return {
    status: to,
    completedAt: to === "done" ? new Date() : null,
    boardOrder: (await repo.maxBoardOrder(ctx.wedding.id, to)) + 1,
  };
}

export async function updateTask(
  ctx: TaskContext,
  taskId: string,
  input: UpdateTaskInput,
  ifMatch?: Date,
): Promise<TaskDto> {
  assertCanEdit(ctx);
  const existing = await getTask(ctx, taskId);
  await assertAssignee(ctx.wedding.id, input.assigneeId);
  const { status, ...rest } = input;
  const outcome = await repo.updateTask(
    ctx.wedding.id,
    taskId,
    { ...rest, ...(await statusPatch(ctx, existing.status, status)) },
    today(ctx),
    ifMatch,
  );
  if (outcome.status === "missing") throw notFound("Task not found");
  if (outcome.status === "conflict") throw conflict(outcome.current);
  if (status === "done" && existing.status !== "done") {
    await log(ctx, taskId, "updated", `${ctx.user.name} finished "${outcome.task.title}"`);
  }
  return outcome.task;
}

const MIN_GAP = 1e-6;

/** A drag on the board: lands between `beforeId` (above) and `afterId` (below) in `status`. */
export async function moveTask(
  ctx: TaskContext,
  taskId: string,
  input: MoveTaskInput,
  ifMatch?: Date,
): Promise<TaskDto> {
  assertCanEdit(ctx);
  const existing = await getTask(ctx, taskId);

  const neighbour = async (id: string | null) => {
    if (!id || id === taskId) return null;
    const t = await repo.findTask(ctx.wedding.id, id, today(ctx));
    if (!t || t.status !== input.status) {
      throw new AppError("VALIDATION_FAILED", "The board changed; refresh and try again", {
        fields: { [id === input.beforeId ? "beforeId" : "afterId"]: "Not in that column" },
      });
    }
    return t;
  };

  const neighbours = () => Promise.all([neighbour(input.beforeId), neighbour(input.afterId)]);
  let [before, after] = await neighbours();
  // Repeated drags into the same gap halve it each time; renumber before floats run out.
  if (before && after && after.boardOrder - before.boardOrder < MIN_GAP) {
    await repo.renumberColumn(ctx.wedding.id, input.status);
    [before, after] = await neighbours();
  }
  let boardOrder: number;
  if (before && after) boardOrder = (before.boardOrder + after.boardOrder) / 2;
  else if (before) boardOrder = before.boardOrder + 1;
  else if (after) boardOrder = after.boardOrder - 1;
  else boardOrder = (await repo.maxBoardOrder(ctx.wedding.id, input.status)) + 1;

  const outcome = await repo.updateTask(
    ctx.wedding.id,
    taskId,
    {
      boardOrder,
      ...(input.status !== existing.status
        ? { status: input.status, completedAt: input.status === "done" ? new Date() : null }
        : {}),
    },
    today(ctx),
    ifMatch,
  );
  if (outcome.status === "missing") throw notFound("Task not found");
  if (outcome.status === "conflict") throw conflict(outcome.current);
  if (input.status === "done" && existing.status !== "done") {
    await log(ctx, taskId, "updated", `${ctx.user.name} finished "${outcome.task.title}"`);
  }
  return outcome.task;
}

/** Owners and managers can delete any task; organizers only the ones they created. */
export async function deleteTask(ctx: TaskContext, taskId: string): Promise<void> {
  const task = await getTask(ctx, taskId);
  const planner = can(ctx.membership.role, "events.edit");
  if (!planner && task.createdBy !== ctx.user.id)
    throw forbidden("Only managers or the task's creator can delete it");
  await repo.deleteTask(ctx.wedding.id, taskId);
  await log(ctx, taskId, "deleted", `${ctx.user.name} deleted the task "${task.title}"`);
}

/**
 * Starter checklist import (FR-5.3). Due dates count back from the event's day
 * (or the main wedding date for the general list); any already past become today.
 */
export async function importChecklist(
  ctx: TaskContext,
  target: { eventId: string | null; eventType: EventType | null; date: string },
  itemIds: string[],
): Promise<TaskDto[]> {
  assertCanEdit(ctx);
  const wanted = new Set(itemIds);
  const items = checklistFor(target.eventType).filter((i) => wanted.has(i.id));
  if (items.length === 0) {
    throw new AppError("VALIDATION_FAILED", "Tick at least one item from this checklist", {
      fields: { itemIds: "None of those items belong to this checklist" },
    });
  }
  const day = today(ctx);
  let order = await repo.maxBoardOrder(ctx.wedding.id, "todo");
  const tasks = await repo.insertTasks(
    ctx.wedding.id,
    items.map((item) => {
      const due = addDays(target.date, -item.daysBefore);
      order += 1;
      return {
        title: item.title,
        description: null,
        status: "todo",
        priority: item.priority,
        assigneeId: null,
        eventId: target.eventId,
        dueAt: due < day ? day : due,
        boardOrder: order,
        createdBy: ctx.user.id,
      };
    }),
    day,
  );
  await logActivity({
    weddingId: ctx.wedding.id,
    actorId: ctx.user.id,
    actorLabel: ctx.user.name,
    action: "created",
    entity: "task",
    entityId: tasks[0]?.id ?? ctx.wedding.id,
    summary: `${ctx.user.name} added ${String(tasks.length)} tasks from a starter checklist`,
  });
  return tasks;
}

export function countWeddingTasks(weddingId: string, timezone: string): Promise<TaskCountsDto> {
  return repo.countTasks(weddingId, todayIn(timezone));
}

export function countTasksForEvent(weddingId: string, eventId: string): Promise<number> {
  return repo.countTasksForEvent(weddingId, eventId);
}

export function unlinkEventTasks(
  weddingId: string,
  eventId: string,
  session: DbSession,
): Promise<number> {
  return repo.unlinkEvent(weddingId, eventId, session);
}
