import "server-only";

import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { AppError, notFound } from "@/lib/errors";
import {
  created,
  list,
  noContent,
  ok,
  parseJson,
  parseParams,
  parseQuery,
  route,
} from "@/lib/http";
import { toIcs } from "@/lib/ics";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { hashToken } from "@/lib/tokens";
import { objectId } from "@/lib/validation/common";
import { listWeddingEvents } from "@/modules/events";
import { getPublicWedding, requireAccess } from "@/modules/weddings";

import { commitImport, previewImport, undoImport } from "./csv-import";
import {
  getTemplates,
  inviteMessage,
  markSent,
  regenerateRsvpLink,
  saveTemplates,
} from "./messages";
import {
  createHouseholdSchema,
  exportQuerySchema,
  guestSchema,
  householdQuerySchema,
  importCommitSchema,
  inviteMessageQuerySchema,
  markSentSchema,
  rsvpAnswerSchema,
  submitRsvpSchema,
  templatesSchema,
  updateGuestSchema,
  updateHouseholdSchema,
} from "./schema";
import {
  addGuest,
  attendingEventIds,
  clearRsvp,
  createHousehold,
  deleteHousehold,
  eventRsvps,
  exportRsvpsCsv,
  findHouseholdByToken,
  getHousehold,
  listHouseholds,
  markOpened,
  publicRsvp,
  removeGuest,
  rsvpClosed,
  rsvpSummary,
  setRsvp,
  submitGuestRsvp,
  updateGuest,
  updateHousehold,
} from "./service";

type WeddingParams = { weddingId: string };
type HouseholdParams = { weddingId: string; householdId: string };
type GuestParams = { weddingId: string; guestId: string };
type EventParams = { weddingId: string; eventId: string };
type HouseholdEventParams = { weddingId: string; householdId: string; eventId: string };
type BatchParams = { weddingId: string; importBatchId: string };
type TokenParams = { token: string };

const weddingParams = z.object({ weddingId: objectId });
const householdParams = z.object({ weddingId: objectId, householdId: objectId });
const guestParams = z.object({ weddingId: objectId, guestId: objectId });
const eventParams = z.object({ weddingId: objectId, eventId: objectId });
const householdEventParams = householdParams.extend({ eventId: objectId });
const batchParams = z.object({ weddingId: objectId, importBatchId: z.uuid() });
const tokenParams = z.object({ token: z.string().regex(/^[\w-]{20,100}$/) });

const MAX_CSV_BYTES = 2 * 1024 * 1024;

// Households and guests

/** GET /api/weddings/:weddingId/households?side&group&messageState&eventId&rsvp=pending&q (viewer). */
export const listHouseholdsHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  const ctx = await requireAccess(user, weddingId, "rsvps.view");
  return list(await listHouseholds(ctx, parseQuery(request, householdQuerySchema)));
});

/** POST /api/weddings/:weddingId/households: the household and its guests together (organizer). */
export const createHouseholdHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  const ctx = await requireAccess(user, weddingId, "guests.edit");
  const input = await parseJson(request, createHouseholdSchema);
  return created(await createHousehold(ctx, input, await listWeddingEvents(weddingId)));
});

/** GET /api/weddings/:weddingId/households/:householdId (viewer). */
export const getHouseholdHandler = route<HouseholdParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId, householdId } = parseParams(params, householdParams);
  const ctx = await requireAccess(user, weddingId, "rsvps.view");
  return ok(await getHousehold(ctx, householdId));
});

/** PATCH /api/weddings/:weddingId/households/:householdId (organizer). */
export const patchHouseholdHandler = route<HouseholdParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId, householdId } = parseParams(params, householdParams);
  const ctx = await requireAccess(user, weddingId, "guests.edit");
  const input = await parseJson(request, updateHouseholdSchema);
  return ok(await updateHousehold(ctx, householdId, input, await listWeddingEvents(weddingId)));
});

/** DELETE /api/weddings/:weddingId/households/:householdId: with its guests and RSVPs (organizer). */
export const deleteHouseholdHandler = route<HouseholdParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId, householdId } = parseParams(params, householdParams);
  const ctx = await requireAccess(user, weddingId, "guests.edit");
  await deleteHousehold(ctx, householdId);
  return noContent();
});

/** POST /api/weddings/:weddingId/households/:householdId/guests (organizer). */
export const addGuestHandler = route<HouseholdParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId, householdId } = parseParams(params, householdParams);
  const ctx = await requireAccess(user, weddingId, "guests.edit");
  return created(await addGuest(ctx, householdId, await parseJson(request, guestSchema)));
});

/** PATCH /api/weddings/:weddingId/guests/:guestId (organizer). */
export const patchGuestHandler = route<GuestParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId, guestId } = parseParams(params, guestParams);
  const ctx = await requireAccess(user, weddingId, "guests.edit");
  return ok(await updateGuest(ctx, guestId, await parseJson(request, updateGuestSchema)));
});

/** DELETE /api/weddings/:weddingId/guests/:guestId (organizer); not the main contact. */
export const deleteGuestHandler = route<GuestParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId, guestId } = parseParams(params, guestParams);
  const ctx = await requireAccess(user, weddingId, "guests.edit");
  await removeGuest(ctx, guestId);
  return noContent();
});

// CSV import

/** POST /api/weddings/:weddingId/guests/import/preview: multipart `file`, up to 2 MB (organizer). */
export const previewImportHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  const ctx = await requireAccess(user, weddingId, "guests.edit");
  if (!(request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    throw new AppError("UNSUPPORTED_MEDIA_TYPE", "Upload the CSV file as multipart/form-data");
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_CSV_BYTES + 64 * 1024) {
    throw new AppError("PAYLOAD_TOO_LARGE", "The file is larger than 2 MB");
  }
  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) {
    throw new AppError("VALIDATION_FAILED", "Choose a CSV file", {
      fields: { file: "Choose a CSV file" },
    });
  }
  if (file.size > MAX_CSV_BYTES)
    throw new AppError("PAYLOAD_TOO_LARGE", "The file is larger than 2 MB");
  return ok(await previewImport(ctx, await file.text()));
});

/** POST /api/weddings/:weddingId/guests/import: commit previewed rows (organizer). */
export const commitImportHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  const ctx = await requireAccess(user, weddingId, "guests.edit");
  const { rows, eventIds } = await parseJson(request, importCommitSchema);
  return created(await commitImport(ctx, rows, eventIds, await listWeddingEvents(weddingId)));
});

/** DELETE /api/weddings/:weddingId/guests/import/:importBatchId: undo within 24 hours (organizer). */
export const undoImportHandler = route<BatchParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId, importBatchId } = parseParams(params, batchParams);
  const ctx = await requireAccess(user, weddingId, "guests.edit");
  return ok(await undoImport(ctx, importBatchId));
});

// RSVPs (dashboard side)

/** GET /api/weddings/:weddingId/rsvps/summary (viewer). */
export const rsvpSummaryHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  return ok(await rsvpSummary(await requireAccess(user, weddingId, "rsvps.view")));
});

/** GET /api/weddings/:weddingId/events/:eventId/rsvps: invited households with answers (viewer). */
export const eventRsvpsHandler = route<EventParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId, eventId } = parseParams(params, eventParams);
  const ctx = await requireAccess(user, weddingId, "rsvps.view");
  return list(await eventRsvps(ctx, eventId));
});

/** POST /api/weddings/:weddingId/households/:householdId/rsvps: answer on their behalf (organizer). */
export const setRsvpHandler = route<HouseholdParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId, householdId } = parseParams(params, householdParams);
  const ctx = await requireAccess(user, weddingId, "guests.edit");
  return ok(await setRsvp(ctx, householdId, await parseJson(request, rsvpAnswerSchema)));
});

/** DELETE /api/weddings/:weddingId/households/:householdId/rsvps/:eventId: back to pending (organizer). */
export const clearRsvpHandler = route<HouseholdEventParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId, householdId, eventId } = parseParams(params, householdEventParams);
  const ctx = await requireAccess(user, weddingId, "guests.edit");
  await clearRsvp(ctx, householdId, eventId);
  return noContent();
});

/** GET /api/weddings/:weddingId/rsvps/export.csv?eventId=: the caterer's sheet (manager). */
export const exportRsvpsHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  const ctx = await requireAccess(user, weddingId, "rsvps.export");
  const { eventId } = parseQuery(request, exportQuerySchema);
  const csv = await exportRsvpsCsv(ctx, await listWeddingEvents(weddingId), eventId);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rsvps-${ctx.wedding.slug}.csv"`,
    },
  });
});

// WhatsApp invites

/** GET /api/weddings/:weddingId/households/:householdId/invite?kind&eventId (organizer). */
export const inviteMessageHandler = route<HouseholdParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId, householdId } = parseParams(params, householdParams);
  const ctx = await requireAccess(user, weddingId, "guests.edit");
  const { kind, eventId } = parseQuery(request, inviteMessageQuerySchema);
  const events = await listWeddingEvents(weddingId);
  return ok(await inviteMessage(ctx, ctx.wedding, householdId, kind, events, eventId));
});

/** POST /api/weddings/:weddingId/households/:householdId/message/mark-sent: { kind } (organizer). */
export const markSentHandler = route<HouseholdParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId, householdId } = parseParams(params, householdParams);
  const ctx = await requireAccess(user, weddingId, "guests.edit");
  const { kind } = await parseJson(request, markSentSchema);
  await markSent(ctx, householdId, kind);
  return ok(await getHousehold(ctx, householdId));
});

/** POST /api/weddings/:weddingId/households/:householdId/rsvp-link/regenerate (organizer). */
export const regenerateLinkHandler = route<HouseholdParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId, householdId } = parseParams(params, householdParams);
  const ctx = await requireAccess(user, weddingId, "guests.edit");
  return ok(await regenerateRsvpLink(ctx, householdId));
});

/** GET /api/weddings/:weddingId/message-templates (organizer). */
export const getTemplatesHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  await requireAccess(user, weddingId, "guests.edit");
  return ok(await getTemplates(weddingId));
});

/** PUT /api/weddings/:weddingId/message-templates: { invite, reminder, eventDay } (organizer). */
export const putTemplatesHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  const ctx = await requireAccess(user, weddingId, "guests.edit");
  return ok(await saveTemplates(ctx, await parseJson(request, templatesSchema)));
});

// The guest's RSVP link (no account; the token is the key)

/** The household and wedding behind a link; any failure is the same 404. */
async function openRsvpLink(request: Request, params: unknown) {
  await rateLimit(`public:${clientIp(request)}`, 120, 60);
  const { token } = parseParams(params, tokenParams);
  const household = await findHouseholdByToken(token);
  const wedding = household ? await getPublicWedding(household.weddingId) : null;
  if (!household || !wedding) throw notFound("This RSVP link isn't valid");
  return { token, household, wedding };
}

/** GET /api/public/rsvp/:token: what the guest's page shows. */
export const getPublicRsvpHandler = route<TokenParams>(async (request, { params }) => {
  const { household, wedding } = await openRsvpLink(request, params);
  const events = (await listWeddingEvents(wedding.id)).filter((e) =>
    household.invitedEventIds.includes(e.id),
  );
  return ok({
    wedding: {
      brideName: wedding.brideName,
      groomName: wedding.groomName,
      primaryDate: wedding.primaryDate,
      city: wedding.city,
      timezone: wedding.timezone,
      rsvpDeadline: wedding.rsvpDeadline,
      closed: rsvpClosed(wedding),
    },
    events: events.map((e) => ({
      id: e.id,
      name: e.name,
      startAt: e.startAt,
      endAt: e.endAt,
      venue: e.venue,
      dressCode: e.dressCode,
    })),
    ...(await publicRsvp(household)),
  });
});

/** POST /api/public/rsvp/:token: { answers: [{ eventId, attending, headcount }] }. */
export const submitPublicRsvpHandler = route<TokenParams>(async (request, { params }) => {
  const { token, household, wedding } = await openRsvpLink(request, params);
  await rateLimit(`rsvp:${hashToken(token)}`, 20, 3600);
  const { answers } = await parseJson(request, submitRsvpSchema);
  await submitGuestRsvp(household, wedding, answers);
  return ok(await publicRsvp(household));
});

/** POST /api/public/rsvp/:token/opened: the page's beacon, so link previews don't count as opens. */
export const rsvpOpenedHandler = route<TokenParams>(async (request, { params }) => {
  const { household } = await openRsvpLink(request, params);
  await markOpened(household);
  return noContent();
});

/** GET /api/public/rsvp/:token/calendar.ics: the events the family said yes to. */
export const rsvpCalendarHandler = route<TokenParams>(async (request, { params }) => {
  const { household, wedding } = await openRsvpLink(request, params);
  const attending = new Set(await attendingEventIds(household));
  const events = (await listWeddingEvents(wedding.id)).filter((e) => attending.has(e.id));
  const couple = `${wedding.brideName} & ${wedding.groomName}`;
  const ics = toIcs(
    events.map((e) => ({
      uid: `${e.id}-${household.id}@makemymarriage`,
      title: `${e.name}: ${couple}`,
      startAt: e.startAt,
      endAt: e.endAt,
      location: [e.venue.name, e.venue.address].filter(Boolean).join(", ") || null,
      description: e.dressCode ? `Dress code: ${e.dressCode}` : null,
    })),
    `Wedding of ${couple}`,
  );
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="wedding.ics"',
    },
  });
});
