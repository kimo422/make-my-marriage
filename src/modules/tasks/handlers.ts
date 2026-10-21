import "server-only";

import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { addDays, todayIn, utcToZoned } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import {
  created,
  list,
  noContent,
  ok,
  parseJson,
  parseParams,
  parseQuery,
  readIfMatch,
  route,
} from "@/lib/http";
import { objectId } from "@/lib/validation/common";
import { findWeddingEvent, getEvent } from "@/modules/events";
import { requireAccess } from "@/modules/weddings";

import { checklistFor } from "./checklists";
import {
  checklistQuerySchema,
  createTaskSchema,
  importChecklistSchema,
  moveTaskSchema,
  taskQuerySchema,
  updateTaskSchema,
} from "./schema";
import {
  createTask,
  deleteTask,
  getTask,
  importChecklist,
  listWeddingTasks,
  moveTask,
  updateTask,
} from "./service";

type WeddingParams = { weddingId: string };
type TaskParams = { weddingId: string; taskId: string };
const weddingParams = z.object({ weddingId: objectId });
const taskParams = z.object({ weddingId: objectId, taskId: objectId });

/** A task may only link to an event of the same wedding (Database Design, service rules). */
async function assertEvent(weddingId: string, eventId: string | null | undefined) {
  if (eventId && !(await findWeddingEvent(weddingId, eventId))) {
    throw new AppError("VALIDATION_FAILED", "Choose an event from this wedding", {
      fields: { eventId: "Choose an event from this wedding" },
    });
  }
}

/** GET /api/weddings/:weddingId/tasks?status&assigneeId(|me)&eventId&overdue (viewer). */
export const listTasksHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  const ctx = await requireAccess(user, weddingId, "wedding.view");
  return list(await listWeddingTasks(ctx, parseQuery(request, taskQuerySchema)));
});

/** POST /api/weddings/:weddingId/tasks (organizer). */
export const createTaskHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  const ctx = await requireAccess(user, weddingId, "tasks.edit");
  const input = await parseJson(request, createTaskSchema);
  await assertEvent(weddingId, input.eventId);
  return created(await createTask(ctx, input));
});

/** GET /api/weddings/:weddingId/tasks/:taskId (viewer). */
export const getTaskHandler = route<TaskParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId, taskId } = parseParams(params, taskParams);
  const ctx = await requireAccess(user, weddingId, "wedding.view");
  return ok(await getTask(ctx, taskId));
});

/** PATCH /api/weddings/:weddingId/tasks/:taskId (organizer); honours If-Match. */
export const patchTaskHandler = route<TaskParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId, taskId } = parseParams(params, taskParams);
  const ctx = await requireAccess(user, weddingId, "tasks.edit");
  const input = await parseJson(request, updateTaskSchema);
  await assertEvent(weddingId, input.eventId);
  return ok(await updateTask(ctx, taskId, input, readIfMatch(request)));
});

/** POST /api/weddings/:weddingId/tasks/:taskId/move: { status, beforeId, afterId } (organizer). */
export const moveTaskHandler = route<TaskParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId, taskId } = parseParams(params, taskParams);
  const ctx = await requireAccess(user, weddingId, "tasks.edit");
  const input = await parseJson(request, moveTaskSchema);
  return ok(await moveTask(ctx, taskId, input, readIfMatch(request)));
});

/** DELETE /api/weddings/:weddingId/tasks/:taskId (manager, or the task's creator). */
export const deleteTaskHandler = route<TaskParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId, taskId } = parseParams(params, taskParams);
  const ctx = await requireAccess(user, weddingId, "tasks.edit");
  await deleteTask(ctx, taskId);
  return noContent();
});

/** The date a checklist counts back from: the event's day in the wedding's zone, or the main date. */
async function checklistTarget(
  weddingId: string,
  timezone: string,
  primaryDate: string,
  eventId: string | null | undefined,
) {
  if (!eventId)
    return { eventId: null, eventType: null, name: "The whole wedding", date: primaryDate };
  const event = await getEvent(weddingId, eventId);
  return {
    eventId,
    eventType: event.type,
    name: event.name,
    date: utcToZoned(event.startAt, timezone).date,
  };
}

/** GET /api/weddings/:weddingId/checklists?eventId=: starter items with their proposed due dates. */
export const checklistHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  const { wedding } = await requireAccess(user, weddingId, "tasks.edit");
  const { eventId } = parseQuery(request, checklistQuerySchema);
  const target = await checklistTarget(weddingId, wedding.timezone, wedding.primaryDate, eventId);
  const today = todayIn(wedding.timezone);
  return ok({
    target: { eventId: target.eventId, name: target.name, date: target.date },
    items: checklistFor(target.eventType).map((item) => {
      const due = addDays(target.date, -item.daysBefore);
      return { ...item, dueAt: due < today ? today : due };
    }),
  });
});

/** POST /api/weddings/:weddingId/tasks/import-checklist: { eventId | null, itemIds } (organizer). */
export const importChecklistHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  const ctx = await requireAccess(user, weddingId, "tasks.edit");
  const { eventId, itemIds } = await parseJson(request, importChecklistSchema);
  const target = await checklistTarget(
    weddingId,
    ctx.wedding.timezone,
    ctx.wedding.primaryDate,
    eventId,
  );
  return created(await importChecklist(ctx, target, itemIds));
});
