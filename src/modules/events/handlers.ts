import "server-only";

import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { created, list, ok, parseJson, parseParams, readIfMatch, route } from "@/lib/http";
import { objectId } from "@/lib/validation/common";
import { requireAccess } from "@/modules/weddings";

import { createEventSchema, reorderEventsSchema, updateEventSchema } from "./schema";
import {
  createEvent,
  deleteEvent,
  eventImpact,
  getEvent,
  listWeddingEvents,
  reorderEvents,
  updateEvent,
} from "./service";

type WeddingParams = { weddingId: string };
type EventParams = { weddingId: string; eventId: string };
const weddingParams = z.object({ weddingId: objectId });
const eventParams = z.object({ weddingId: objectId, eventId: objectId });

/** GET /api/weddings/:weddingId/events: every event, in dashboard order (min role: viewer). */
export const listEventsHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  await requireAccess(user, weddingId, "wedding.view");
  return list(await listWeddingEvents(weddingId));
});

/** POST /api/weddings/:weddingId/events (manager). */
export const createEventHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  const ctx = await requireAccess(user, weddingId, "events.edit");
  return created(await createEvent(ctx, await parseJson(request, createEventSchema)));
});

/** GET /api/weddings/:weddingId/events/:eventId (viewer). */
export const getEventHandler = route<EventParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId, eventId } = parseParams(params, eventParams);
  await requireAccess(user, weddingId, "wedding.view");
  return ok(await getEvent(weddingId, eventId));
});

/** PATCH /api/weddings/:weddingId/events/:eventId (manager); honours If-Match. */
export const patchEventHandler = route<EventParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId, eventId } = parseParams(params, eventParams);
  const ctx = await requireAccess(user, weddingId, "events.edit");
  const input = await parseJson(request, updateEventSchema);
  return ok(await updateEvent(ctx, eventId, input, readIfMatch(request)));
});

/** POST /api/weddings/:weddingId/events/reorder: { ids } in the new order (manager). */
export const reorderEventsHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  const ctx = await requireAccess(user, weddingId, "events.edit");
  const { ids } = await parseJson(request, reorderEventsSchema);
  return list(await reorderEvents(ctx, ids));
});

/** GET /api/weddings/:weddingId/events/:eventId/impact: what deleting would affect (manager). */
export const eventImpactHandler = route<EventParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId, eventId } = parseParams(params, eventParams);
  await requireAccess(user, weddingId, "events.edit");
  return ok(await eventImpact(weddingId, eventId));
});

/** DELETE /api/weddings/:weddingId/events/:eventId (manager); returns the same counts as impact. */
export const deleteEventHandler = route<EventParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId, eventId } = parseParams(params, eventParams);
  const ctx = await requireAccess(user, weddingId, "events.edit");
  return ok(await deleteEvent(ctx, eventId));
});
