import "server-only";

import { toCsv } from "@/lib/csv";
import { withTransaction, type DbSession } from "@/lib/db/connect";
import { todayIn } from "@/lib/dates";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { deriveLinkToken, hashToken } from "@/lib/tokens";
import { logActivity } from "@/modules/activity";
import { can, type Role, type Side } from "@/modules/members";

import * as repo from "./repo";
import type {
  CreateHouseholdInput,
  GuestInput,
  HouseholdQuery,
  HouseholdSide,
  RsvpAnswer,
  UpdateGuestInput,
  UpdateHouseholdInput,
} from "./schema";
import type { EventRsvpSummaryDto, GuestDto, HouseholdDto, RsvpDto } from "./types";

/** What the guests service needs about the caller; weddings.requireAccess() provides it. */
export interface GuestContext {
  user: { id: string; name: string };
  membership: { role: Role; side: Side };
  wedding: { id: string; timezone: string; rsvpDeadline: string | null };
}

/**
 * The wedding's events as the guests module sees them. Guests can't import
 * events (events imports guests for its delete cascade), so handlers pass them in.
 */
export interface EventInfo {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  venue: { name: string | null; address: string | null; mapUrl: string | null };
}

// Side scoping (API Design, "Permission matrix"): organizers see and change
// their own side only. Another side's household is a 404, so it doesn't leak.

function scopedSides(ctx: GuestContext): HouseholdSide[] | undefined {
  const { role, side } = ctx.membership;
  return role === "organizer" && side !== "both" ? [side] : undefined;
}

function canSee(ctx: GuestContext, side: HouseholdSide): boolean {
  const sides = scopedSides(ctx);
  return !sides || sides.includes(side);
}

function assertCanEdit(ctx: GuestContext) {
  if (!can(ctx.membership.role, "guests.edit")) throw forbidden();
}

function assertSideAllowed(ctx: GuestContext, side: HouseholdSide) {
  if (!canSee(ctx, side)) {
    throw new AppError("FORBIDDEN", "You can only add guests on your own side", {
      fields: { side: "You can only add guests on your own side" },
    });
  }
}

/** Decision 6: viewers never receive phone numbers or emails. */
function present(ctx: GuestContext, guest: GuestDto): GuestDto {
  if (can(ctx.membership.role, "guests.viewContacts")) return guest;
  return { ...guest, phone: null, email: null };
}

function assertEventsExist(ids: string[] | undefined, events: EventInfo[]) {
  if (!ids) return;
  const known = new Set(events.map((e) => e.id));
  if (ids.some((id) => !known.has(id))) {
    throw new AppError("VALIDATION_FAILED", "Choose events from this wedding", {
      fields: { invitedEventIds: "Choose events from this wedding" },
    });
  }
}

function log(
  ctx: GuestContext,
  action: "created" | "updated" | "deleted" | "rsvped" | "regenerated_link",
  entity: "household" | "guest",
  entityId: string,
  summary: string,
  session?: DbSession,
) {
  return logActivity(
    {
      weddingId: ctx.wedding.id,
      actorId: ctx.user.id,
      actorLabel: ctx.user.name,
      action,
      entity,
      entityId,
      summary,
    },
    session,
  );
}

export function rsvpTokenFor(householdId: string, version: number): string {
  return deriveLinkToken("rsvp", householdId, version);
}

async function assemble(
  ctx: GuestContext,
  households: repo.HouseholdRecord[],
): Promise<HouseholdDto[]> {
  if (households.length === 0) return [];
  const ids = households.map((h) => h.id);
  const [guests, rsvps] = await Promise.all([
    repo.listGuests(ctx.wedding.id, ids),
    repo.listRsvps(ctx.wedding.id, ids),
  ]);
  const guestsBy = Map.groupBy(guests, (g) => g.householdId);
  const rsvpsBy = Map.groupBy(rsvps, (r) => r.householdId);
  return households.map((h) => ({
    id: h.id,
    name: h.name,
    side: h.side,
    group: h.group,
    maxHeadcount: h.maxHeadcount,
    invitedEventIds: h.invitedEventIds,
    primaryGuestId: h.primaryGuestId,
    notes: h.notes,
    message: h.message,
    guests: (guestsBy.get(h.id) ?? []).map((g) => present(ctx, g)),
    rsvps: (rsvpsBy.get(h.id) ?? []).map(({ householdId: _, ...r }) => r),
    importBatchId: h.importBatchId,
    updatedAt: h.updatedAt,
  }));
}

function hasPendingAnswer(h: HouseholdDto, eventId?: string): boolean {
  const answered = new Set(h.rsvps.map((r) => r.eventId));
  const events = eventId ? [eventId] : h.invitedEventIds;
  return events.some((id) => h.invitedEventIds.includes(id) && !answered.has(id));
}

// Households

export async function listHouseholds(
  ctx: GuestContext,
  query: Partial<HouseholdQuery> = {},
): Promise<HouseholdDto[]> {
  const scoped = scopedSides(ctx);
  if (scoped && query.side && !scoped.includes(query.side)) return [];
  const records = await repo.listHouseholds(ctx.wedding.id, {
    sides: query.side ? [query.side] : scoped,
    group: query.group,
    messageState: query.messageState,
    eventId: query.eventId,
    q: query.q,
  });
  const households = await assemble(ctx, records);
  return query.rsvp === "pending"
    ? households.filter((h) => hasPendingAnswer(h, query.eventId))
    : households;
}

async function findVisible(ctx: GuestContext, householdId: string) {
  const household = await repo.findHousehold(ctx.wedding.id, householdId);
  if (!household || !canSee(ctx, household.side)) throw notFound("Household not found");
  return household;
}

/** For other guests-module files: a household the caller may change, or 403/404. */
export async function findEditableHousehold(ctx: GuestContext, householdId: string) {
  assertCanEdit(ctx);
  return findVisible(ctx, householdId);
}

export async function getHousehold(ctx: GuestContext, householdId: string): Promise<HouseholdDto> {
  const [dto] = await assemble(ctx, [await findVisible(ctx, householdId)]);
  if (!dto) throw notFound("Household not found");
  return dto;
}

function newGuests(
  householdId: string,
  guests: GuestInput[],
  importBatchId: string | null,
): repo.NewGuest[] {
  return guests.map((g) => ({
    id: repo.newId(),
    householdId,
    name: g.name,
    phone: g.phone ?? null,
    email: g.email ?? null,
    relation: g.relation ?? null,
    isChild: g.isChild ?? false,
    importBatchId,
  }));
}

/** The guest WhatsApp messages go to: the first adult with a phone, else the first guest. */
function choosePrimary(guests: repo.NewGuest[]): string | null {
  return (
    (guests.find((g) => g.phone && !g.isChild) ?? guests.find((g) => g.phone) ?? guests[0])?.id ??
    null
  );
}

/** Builds a household and its guests, ready to insert, with its first RSVP link. */
export function prepareHousehold(
  ctx: GuestContext,
  input: {
    name: string;
    side: HouseholdSide;
    group?: string | null | undefined;
    maxHeadcount?: number | null | undefined;
    invitedEventIds?: string[] | undefined;
    notes?: string | null | undefined;
    guests: GuestInput[];
  },
  importBatchId: string | null,
): { household: repo.NewHousehold; guests: repo.NewGuest[] } {
  const id = repo.newId();
  const guests = newGuests(id, input.guests, importBatchId);
  return {
    household: {
      id,
      name: input.name,
      side: input.side,
      group: input.group ?? null,
      maxHeadcount: input.maxHeadcount ?? Math.max(1, guests.length),
      invitedEventIds: input.invitedEventIds ?? [],
      rsvpTokenHash: hashToken(rsvpTokenFor(id, 1)),
      primaryGuestId: choosePrimary(guests),
      notes: input.notes ?? null,
      importBatchId,
      createdBy: ctx.user.id,
    },
    guests,
  };
}

export async function createHousehold(
  ctx: GuestContext,
  input: CreateHouseholdInput,
  events: EventInfo[],
): Promise<HouseholdDto> {
  assertCanEdit(ctx);
  assertSideAllowed(ctx, input.side);
  assertEventsExist(input.invitedEventIds, events);
  const { household, guests } = prepareHousehold(ctx, input, null);
  await withTransaction(async (session) => {
    await repo.insertHouseholds(ctx.wedding.id, [household], session);
    await repo.insertGuests(ctx.wedding.id, guests, session);
    await log(
      ctx,
      "created",
      "household",
      household.id,
      `${ctx.user.name} added ${household.name}`,
      session,
    );
  });
  return getHousehold(ctx, household.id);
}

export async function updateHousehold(
  ctx: GuestContext,
  householdId: string,
  input: UpdateHouseholdInput,
  events: EventInfo[],
): Promise<HouseholdDto> {
  assertCanEdit(ctx);
  const current = await findVisible(ctx, householdId);
  if (input.side) assertSideAllowed(ctx, input.side);
  assertEventsExist(input.invitedEventIds, events);
  if (input.primaryGuestId) {
    const guest = await repo.findGuest(ctx.wedding.id, input.primaryGuestId);
    if (guest?.householdId !== householdId) {
      throw new AppError("VALIDATION_FAILED", "Choose someone from this household", {
        fields: { primaryGuestId: "Choose someone from this household" },
      });
    }
  }
  await withTransaction(async (session) => {
    await repo.updateHousehold(ctx.wedding.id, householdId, input, session);
    // Un-inviting a family from an event drops its answer for that event.
    if (input.invitedEventIds) {
      await repo.deleteRsvpsOutside(ctx.wedding.id, householdId, input.invitedEventIds, session);
    }
    await log(
      ctx,
      "updated",
      "household",
      householdId,
      `${ctx.user.name} updated ${input.name ?? current.name}`,
      session,
    );
  });
  return getHousehold(ctx, householdId);
}

export async function deleteHousehold(ctx: GuestContext, householdId: string): Promise<void> {
  assertCanEdit(ctx);
  const household = await findVisible(ctx, householdId);
  await withTransaction(async (session) => {
    await repo.deleteHousehold(ctx.wedding.id, householdId, session);
    await log(
      ctx,
      "deleted",
      "household",
      householdId,
      `${ctx.user.name} removed ${household.name}`,
      session,
    );
  });
}

// Guests

export async function addGuest(
  ctx: GuestContext,
  householdId: string,
  input: GuestInput,
): Promise<GuestDto> {
  assertCanEdit(ctx);
  const household = await findVisible(ctx, householdId);
  const existing = await repo.listGuests(ctx.wedding.id, [householdId]);
  if (existing.length >= 20) {
    throw new AppError("VALIDATION_FAILED", "A household can have up to 20 guests");
  }
  const [guest] = newGuests(householdId, [input], null);
  if (!guest) throw new Error("No guest to add");
  await repo.insertGuests(ctx.wedding.id, [guest]);
  if (!household.primaryGuestId) {
    await repo.updateHousehold(ctx.wedding.id, householdId, { primaryGuestId: guest.id });
  }
  await log(
    ctx,
    "created",
    "guest",
    guest.id,
    `${ctx.user.name} added ${guest.name} to ${household.name}`,
  );
  const { importBatchId: _, ...dto } = guest;
  return dto;
}

async function findVisibleGuest(ctx: GuestContext, guestId: string) {
  const guest = await repo.findGuest(ctx.wedding.id, guestId);
  if (!guest) throw notFound("Guest not found");
  const household = await findVisible(ctx, guest.householdId).catch(() => null);
  if (!household) throw notFound("Guest not found");
  return { guest, household };
}

export async function updateGuest(
  ctx: GuestContext,
  guestId: string,
  input: UpdateGuestInput,
): Promise<GuestDto> {
  assertCanEdit(ctx);
  await findVisibleGuest(ctx, guestId);
  const changes = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  const updated = await repo.updateGuest(ctx.wedding.id, guestId, changes);
  if (!updated) throw notFound("Guest not found");
  await log(ctx, "updated", "guest", guestId, `${ctx.user.name} updated ${updated.name}`);
  return updated;
}

export async function removeGuest(ctx: GuestContext, guestId: string): Promise<void> {
  assertCanEdit(ctx);
  const { guest, household } = await findVisibleGuest(ctx, guestId);
  if (household.primaryGuestId === guestId) {
    throw new AppError(
      "VALIDATION_FAILED",
      "This is the household's main contact. Choose someone else first, or remove the whole household.",
    );
  }
  await repo.deleteGuest(ctx.wedding.id, guestId);
  await log(
    ctx,
    "deleted",
    "guest",
    guestId,
    `${ctx.user.name} removed ${guest.name} from ${household.name}`,
  );
}

// RSVPs

/** True once the wedding's RSVP deadline (a date in its time zone) has passed. */
export function rsvpClosed(wedding: { timezone: string; rsvpDeadline: string | null }): boolean {
  return wedding.rsvpDeadline !== null && todayIn(wedding.timezone) > wedding.rsvpDeadline;
}

/** The rules every answer follows, whoever enters it (API Design, RSVP errors). */
function checkAnswer(household: repo.HouseholdRecord, answer: RsvpAnswer): RsvpAnswer {
  if (!household.invitedEventIds.includes(answer.eventId)) {
    throw new AppError("EVENT_NOT_INVITED", "This family isn't invited to that event");
  }
  if (!answer.attending) return { ...answer, headcount: 0 };
  if (answer.headcount < 1) {
    throw new AppError("VALIDATION_FAILED", "Tell us how many are coming", {
      fields: { headcount: "At least 1 when attending" },
    });
  }
  if (answer.headcount > household.maxHeadcount) {
    const max = String(household.maxHeadcount);
    throw new AppError("RSVP_OVER_CAPACITY", `This invitation is for up to ${max}`, {
      fields: { headcount: `Max is ${max}` },
    });
  }
  return answer;
}

/** An organizer enters or changes an answer on a family's behalf; the deadline doesn't apply. */
export async function setRsvp(
  ctx: GuestContext,
  householdId: string,
  answer: RsvpAnswer,
): Promise<RsvpDto & { householdId: string }> {
  assertCanEdit(ctx);
  const household = await findVisible(ctx, householdId);
  const checked = checkAnswer(household, answer);
  const saved = await withTransaction(async (session) => {
    const rsvp = await repo.upsertRsvp(
      ctx.wedding.id,
      householdId,
      { ...checked, source: "organizer" },
      session,
    );
    await repo.advanceMessageState(ctx.wedding.id, householdId, "responded", session);
    await log(
      ctx,
      "rsvped",
      "household",
      householdId,
      `${ctx.user.name} entered an RSVP for ${household.name}`,
      session,
    );
    return rsvp;
  });
  return saved;
}

export async function clearRsvp(
  ctx: GuestContext,
  householdId: string,
  eventId: string,
): Promise<void> {
  assertCanEdit(ctx);
  await findVisible(ctx, householdId);
  await repo.deleteRsvp(ctx.wedding.id, householdId, eventId);
}

export function rsvpSummary(ctx: GuestContext): Promise<EventRsvpSummaryDto[]> {
  return repo.rsvpSummary(ctx.wedding.id, scopedSides(ctx));
}

export interface EventRsvpRowDto {
  householdId: string;
  name: string;
  side: HouseholdSide;
  group: string | null;
  maxHeadcount: number;
  answer: RsvpDto | null;
}

/** Every household invited to the event, with its answer or null for pending. */
export async function eventRsvps(ctx: GuestContext, eventId: string): Promise<EventRsvpRowDto[]> {
  const households = await listHouseholds(ctx, { eventId });
  return households.map((h) => ({
    householdId: h.id,
    name: h.name,
    side: h.side,
    group: h.group,
    maxHeadcount: h.maxHeadcount,
    answer: h.rsvps.find((r) => r.eventId === eventId) ?? null,
  }));
}

// Events cascade (called by the events service)

export function countRsvpsForEvent(weddingId: string, eventId: string): Promise<number> {
  return repo.countRsvpsForEvent(weddingId, eventId);
}

/** Inside the delete-event transaction: un-invite everyone and drop the answers. */
export async function removeEventFromGuests(
  weddingId: string,
  eventId: string,
  session: DbSession,
): Promise<number> {
  await repo.pullEventFromHouseholds(weddingId, eventId, session);
  return repo.deleteRsvpsForEvent(weddingId, eventId, session);
}

// The guest's RSVP link

/** The household behind an RSVP link, or null for a wrong or regenerated token. */
export function findHouseholdByToken(token: string): Promise<repo.HouseholdRecord | null> {
  if (token.length < 20 || token.length > 100) return Promise.resolve(null);
  return repo.findHouseholdByTokenHash(hashToken(token));
}

export interface PublicRsvpDto {
  householdName: string;
  /** First names only: the link may be forwarded within the family. */
  guestNames: string[];
  maxHeadcount: number;
  answers: { eventId: string; attending: boolean; headcount: number }[];
}

export async function publicRsvp(household: repo.HouseholdRecord): Promise<PublicRsvpDto> {
  const [guests, rsvps] = await Promise.all([
    repo.listGuests(household.weddingId, [household.id]),
    repo.listRsvps(household.weddingId, [household.id]),
  ]);
  return {
    householdName: household.name,
    guestNames: guests.map((g) => g.name.split(/\s+/)[0] ?? g.name),
    maxHeadcount: household.maxHeadcount,
    answers: rsvps.map((r) => ({
      eventId: r.eventId,
      attending: r.attending,
      headcount: r.headcount,
    })),
  };
}

/** The guest opened their link (a beacon from the page, so link previews don't count). */
export function markOpened(household: repo.HouseholdRecord): Promise<void> {
  return repo.advanceMessageState(household.weddingId, household.id, "opened");
}

/** The guest's own answers, all saved together; closed after the deadline. */
export async function submitGuestRsvp(
  household: repo.HouseholdRecord,
  wedding: { timezone: string; rsvpDeadline: string | null },
  answers: RsvpAnswer[],
): Promise<void> {
  if (rsvpClosed(wedding)) {
    throw new AppError("RSVP_CLOSED", "RSVPs have closed. Please contact the family directly.");
  }
  const checked = answers.map((a) => checkAnswer(household, a));
  await withTransaction(async (session) => {
    for (const answer of checked) {
      await repo.upsertRsvp(
        household.weddingId,
        household.id,
        { ...answer, source: "guest" },
        session,
      );
    }
    await repo.advanceMessageState(household.weddingId, household.id, "responded", session);
    await logActivity(
      {
        weddingId: household.weddingId,
        actorId: null,
        actorLabel: household.name,
        action: "rsvped",
        entity: "household",
        entityId: household.id,
        summary: `${household.name} replied to the invitation`,
      },
      session,
    );
  });
}

/** The events this household said yes to, for the calendar file. */
export async function attendingEventIds(household: repo.HouseholdRecord): Promise<string[]> {
  const rsvps = await repo.listRsvps(household.weddingId, [household.id]);
  return rsvps
    .filter((r) => r.attending && household.invitedEventIds.includes(r.eventId))
    .map((r) => r.eventId);
}

// Caterer export

/**
 * One row per household with its headcount for each chosen event: a number
 * when attending, "No" when declined, blank while pending.
 */
export async function exportRsvpsCsv(
  ctx: GuestContext,
  events: EventInfo[],
  eventId?: string,
): Promise<string> {
  const chosen = eventId ? events.filter((e) => e.id === eventId) : events;
  if (eventId && chosen.length === 0) throw notFound("Event not found");
  const households = await listHouseholds(ctx);
  const rows = households
    .filter((h) => chosen.some((e) => h.invitedEventIds.includes(e.id)))
    .map((h) => [
      h.name,
      h.side === "bride" ? "Bride" : "Groom",
      h.group ?? "",
      String(h.maxHeadcount),
      ...chosen.map((e) => {
        if (!h.invitedEventIds.includes(e.id)) return "–";
        const answer = h.rsvps.find((r) => r.eventId === e.id);
        if (!answer) return "";
        return answer.attending ? String(answer.headcount) : "No";
      }),
      h.guests.map((g) => g.name).join("; "),
    ]);
  const totals = chosen.map((e) =>
    String(
      households.reduce((sum, h) => {
        const answer = h.rsvps.find((r) => r.eventId === e.id);
        return sum + (answer?.attending ? answer.headcount : 0);
      }, 0),
    ),
  );
  return toCsv([
    ["Household", "Side", "Group", "Invited for", ...chosen.map((e) => e.name), "Guests"],
    ...rows,
    ["Total attending", "", "", "", ...totals, ""],
  ]);
}
