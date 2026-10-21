import "server-only";

import { withTransaction } from "@/lib/db/connect";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { logActivity } from "@/modules/activity";
import { can, type Role } from "@/modules/members";
import { countTasksForEvent, unlinkEventTasks } from "@/modules/tasks";

import * as repo from "./repo";
import { checkTimes, type CreateEventInput, type UpdateEventInput } from "./schema";
import type { EventDto, EventImpactDto } from "./types";

/** What the events service needs about the caller; weddings.requireAccess() provides it. */
export interface EventContext {
  user: { id: string; name: string };
  membership: { role: Role };
  wedding: { id: string };
}

function assertCanEdit(ctx: EventContext) {
  if (!can(ctx.membership.role, "events.edit")) throw forbidden();
}

function log(
  ctx: EventContext,
  eventId: string,
  action: "created" | "updated" | "deleted",
  summary: string,
) {
  return logActivity({
    weddingId: ctx.wedding.id,
    actorId: ctx.user.id,
    actorLabel: ctx.user.name,
    action,
    entity: "event",
    entityId: eventId,
    summary,
  });
}

export function listWeddingEvents(weddingId: string): Promise<EventDto[]> {
  return repo.listEvents(weddingId);
}

export async function getEvent(weddingId: string, eventId: string): Promise<EventDto> {
  const event = await repo.findEvent(weddingId, eventId);
  if (!event) throw notFound("Event not found");
  return event;
}

/** For other modules (tasks) that link to an event: null if it isn't this wedding's. */
export function findWeddingEvent(weddingId: string, eventId: string): Promise<EventDto | null> {
  return repo.findEvent(weddingId, eventId);
}

export function countWeddingEvents(weddingId: string): Promise<number> {
  return repo.countEvents(weddingId);
}

/** New events slot into the list by start time, after any manual reordering so far. */
export async function createEvent(ctx: EventContext, input: CreateEventInput): Promise<EventDto> {
  assertCanEdit(ctx);
  const existing = await repo.listEvents(ctx.wedding.id);
  const created = await repo.insertEvent(ctx.wedding.id, input, existing.length + 1);
  const at = existing.findIndex((e) => e.startAt > created.startAt);
  const ids = existing.map((e) => e.id);
  ids.splice(at === -1 ? ids.length : at, 0, created.id);
  await repo.setOrder(ctx.wedding.id, ids);
  await log(ctx, created.id, "created", `${ctx.user.name} added ${created.name}`);
  return { ...created, order: ids.indexOf(created.id) + 1 };
}

export async function updateEvent(
  ctx: EventContext,
  eventId: string,
  input: UpdateEventInput,
  ifMatch?: Date,
): Promise<EventDto> {
  assertCanEdit(ctx);
  const current = await getEvent(ctx.wedding.id, eventId);
  const problem = checkTimes(input.startAt ?? current.startAt, input.endAt ?? current.endAt);
  if (problem) throw new AppError("VALIDATION_FAILED", problem, { fields: { endAt: problem } });

  const outcome = await repo.updateEvent(ctx.wedding.id, eventId, input, ifMatch);
  if (outcome.status === "missing") throw notFound("Event not found");
  if (outcome.status === "conflict") {
    throw new AppError("CONFLICT", "Someone else changed this event. Here's the latest version.", {
      details: outcome.current,
    });
  }
  await log(ctx, eventId, "updated", `${ctx.user.name} updated ${outcome.event.name}`);
  return outcome.event;
}

/** Sets the dashboard order; `ids` must list every event of the wedding exactly once. */
export async function reorderEvents(ctx: EventContext, ids: string[]): Promise<EventDto[]> {
  assertCanEdit(ctx);
  const existing = await repo.listEvents(ctx.wedding.id);
  const known = new Set(existing.map((e) => e.id));
  if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
    throw new AppError("VALIDATION_FAILED", "The list of events changed; refresh and try again", {
      fields: { ids: "Send every event of this wedding exactly once" },
    });
  }
  await repo.setOrder(ctx.wedding.id, ids);
  return repo.listEvents(ctx.wedding.id);
}

export async function eventImpact(weddingId: string, eventId: string): Promise<EventImpactDto> {
  await getEvent(weddingId, eventId);
  // RSVPs (Phase 4) and photos (Phase 6) join this count, and the cascade, when they exist.
  return {
    tasksUnlinked: await countTasksForEvent(weddingId, eventId),
    rsvpsRemoved: 0,
    photosMoved: 0,
  };
}

/** Deletes the event and unlinks its tasks in one transaction; returns what was affected. */
export async function deleteEvent(ctx: EventContext, eventId: string): Promise<EventImpactDto> {
  assertCanEdit(ctx);
  const event = await getEvent(ctx.wedding.id, eventId);
  const tasksUnlinked = await withTransaction(async (session) => {
    const unlinked = await unlinkEventTasks(ctx.wedding.id, eventId, session);
    await repo.deleteEvent(ctx.wedding.id, eventId, session);
    return unlinked;
  });
  await log(ctx, eventId, "deleted", `${ctx.user.name} deleted ${event.name}`);
  return { tasksUnlinked, rsvpsRemoved: 0, photosMoved: 0 };
}
