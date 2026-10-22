import "server-only";

import { Types } from "mongoose";

import type { DbSession } from "@/lib/db/connect";

import { Guest, Household, MessageTemplate, Rsvp } from "./model";
import type { HouseholdSide, MessageState, Templates } from "./schema";
import type { EventRsvpSummaryDto, GuestDto, MessageStatusDto, RsvpDto } from "./types";

const oid = (id: string) => new Types.ObjectId(id);
const oids = (ids: string[]) => ids.map(oid);
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

// Households

interface HouseholdDoc {
  _id: Types.ObjectId;
  weddingId: Types.ObjectId;
  name: string;
  side: HouseholdSide;
  group?: string | null;
  maxHeadcount: number;
  invitedEventIds?: Types.ObjectId[];
  rsvpTokenVersion?: number;
  primaryGuestId?: Types.ObjectId | null;
  message?: {
    state?: MessageState;
    sentAt?: Date | null;
    firstOpenedAt?: Date | null;
    lastReminderAt?: Date | null;
    reminderCount?: number;
  } | null;
  notes?: string | null;
  importBatchId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A household as the service sees it: plain strings, no ObjectIds. */
export interface HouseholdRecord {
  id: string;
  weddingId: string;
  name: string;
  side: HouseholdSide;
  group: string | null;
  maxHeadcount: number;
  invitedEventIds: string[];
  rsvpTokenVersion: number;
  primaryGuestId: string | null;
  message: MessageStatusDto;
  notes: string | null;
  importBatchId: string | null;
  createdAt: string;
  updatedAt: string;
}

function toHousehold(d: HouseholdDoc): HouseholdRecord {
  return {
    id: d._id.toString(),
    weddingId: d.weddingId.toString(),
    name: d.name,
    side: d.side,
    group: d.group ?? null,
    maxHeadcount: d.maxHeadcount,
    invitedEventIds: (d.invitedEventIds ?? []).map((e) => e.toString()),
    rsvpTokenVersion: d.rsvpTokenVersion ?? 1,
    primaryGuestId: d.primaryGuestId?.toString() ?? null,
    message: {
      state: d.message?.state ?? "not_sent",
      sentAt: iso(d.message?.sentAt),
      firstOpenedAt: iso(d.message?.firstOpenedAt),
      lastReminderAt: iso(d.message?.lastReminderAt),
      reminderCount: d.message?.reminderCount ?? 0,
    },
    notes: d.notes ?? null,
    importBatchId: d.importBatchId ?? null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

export interface HouseholdFilter {
  sides?: HouseholdSide[] | undefined;
  group?: string | undefined;
  messageState?: MessageState | undefined;
  eventId?: string | undefined;
  q?: string | undefined;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Households sorted by side then name (Database Design, "Guest list by side"). */
export async function listHouseholds(
  weddingId: string,
  filter: HouseholdFilter = {},
): Promise<HouseholdRecord[]> {
  const query: Record<string, unknown> = { weddingId: oid(weddingId) };
  if (filter.sides) query.side = { $in: filter.sides };
  if (filter.group) query.group = filter.group;
  if (filter.messageState) query["message.state"] = filter.messageState;
  if (filter.eventId) query.invitedEventIds = oid(filter.eventId);
  if (filter.q) query.name = { $regex: escapeRegex(filter.q), $options: "i" };
  const docs = await Household.find(query)
    .collation({ locale: "en", strength: 2 })
    .sort({ side: 1, name: 1 })
    .lean<HouseholdDoc[]>()
    .exec();
  return docs.map(toHousehold);
}

export async function findHousehold(
  weddingId: string,
  householdId: string,
): Promise<HouseholdRecord | null> {
  if (!Types.ObjectId.isValid(householdId)) return null;
  const doc = await Household.findOne({ weddingId: oid(weddingId), _id: oid(householdId) })
    .lean<HouseholdDoc>()
    .exec();
  return doc ? toHousehold(doc) : null;
}

/** Guest RSVP links arrive before the wedding is known: a deliberate cross-tenant lookup. */
export async function findHouseholdByTokenHash(tokenHash: string): Promise<HouseholdRecord | null> {
  const doc = await Household.findOne({ rsvpTokenHash: tokenHash })
    .setOptions({ tenantScope: "global" })
    .lean<HouseholdDoc>()
    .exec();
  return doc ? toHousehold(doc) : null;
}

export function newId(): string {
  return new Types.ObjectId().toString();
}

export interface NewHousehold {
  id: string;
  name: string;
  side: HouseholdSide;
  group: string | null;
  maxHeadcount: number;
  invitedEventIds: string[];
  rsvpTokenHash: string;
  primaryGuestId: string | null;
  notes: string | null;
  importBatchId: string | null;
  createdBy: string;
}

export async function insertHouseholds(
  weddingId: string,
  households: NewHousehold[],
  session: DbSession,
): Promise<void> {
  if (households.length === 0) return;
  await Household.insertMany(
    households.map(({ id, ...h }) => ({
      ...h,
      _id: oid(id),
      weddingId: oid(weddingId),
      invitedEventIds: oids(h.invitedEventIds),
      primaryGuestId: h.primaryGuestId ? oid(h.primaryGuestId) : null,
      createdBy: oid(h.createdBy),
      rsvpTokenVersion: 1,
    })),
    { session },
  );
}

export interface HouseholdChanges {
  name?: string | undefined;
  side?: HouseholdSide | undefined;
  group?: string | null | undefined;
  maxHeadcount?: number | undefined;
  invitedEventIds?: string[] | undefined;
  primaryGuestId?: string | null | undefined;
  notes?: string | null | undefined;
  rsvpTokenHash?: string | undefined;
  rsvpTokenVersion?: number | undefined;
}

export async function updateHousehold(
  weddingId: string,
  householdId: string,
  changes: HouseholdChanges,
  session?: DbSession,
): Promise<HouseholdRecord | null> {
  const $set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    if (key === "invitedEventIds") $set[key] = oids(value as string[]);
    else if (key === "primaryGuestId") $set[key] = value ? oid(value as string) : null;
    else $set[key] = value;
  }
  const doc = await Household.findOneAndUpdate(
    { weddingId: oid(weddingId), _id: oid(householdId) },
    { $set },
    { returnDocument: "after", runValidators: true, session },
  )
    .lean<HouseholdDoc>()
    .exec();
  return doc ? toHousehold(doc) : null;
}

const EARLIER_STATES: Record<Exclude<MessageState, "not_sent">, MessageState[]> = {
  sent: ["not_sent"],
  opened: ["not_sent", "sent"],
  responded: ["not_sent", "sent", "opened"],
};

/** Moves the message state forward only (not_sent → sent → opened → responded). */
export async function advanceMessageState(
  weddingId: string,
  householdId: string,
  to: Exclude<MessageState, "not_sent">,
  session?: DbSession,
): Promise<void> {
  const $set: Record<string, unknown> = { "message.state": to };
  if (to === "opened") $set["message.firstOpenedAt"] = new Date();
  await Household.updateOne(
    {
      weddingId: oid(weddingId),
      _id: oid(householdId),
      "message.state": { $in: EARLIER_STATES[to] },
    },
    { $set },
    { session, timestamps: false },
  ).exec();
}

/** Records that someone sent the invite or a reminder from their WhatsApp. */
export async function recordSent(
  weddingId: string,
  householdId: string,
  kind: "invite" | "reminder",
  userId: string,
): Promise<void> {
  const filter = { weddingId: oid(weddingId), _id: oid(householdId) };
  const now = new Date();
  if (kind === "invite") {
    await Household.updateOne(filter, {
      $set: { "message.sentAt": now, "message.sentBy": oid(userId) },
    }).exec();
  } else {
    await Household.updateOne(filter, {
      $set: { "message.lastReminderAt": now },
      $inc: { "message.reminderCount": 1 },
    }).exec();
  }
  await advanceMessageState(weddingId, householdId, "sent");
}

export async function deleteHousehold(
  weddingId: string,
  householdId: string,
  session: DbSession,
): Promise<void> {
  const filter = { weddingId: oid(weddingId), householdId: oid(householdId) };
  await Guest.deleteMany(filter, { session }).exec();
  await Rsvp.deleteMany(filter, { session }).exec();
  await Household.deleteOne(
    { weddingId: oid(weddingId), _id: oid(householdId) },
    { session },
  ).exec();
}

/** Deleting an event takes it off every invitation list (Database Design, "Delete event"). */
export async function pullEventFromHouseholds(
  weddingId: string,
  eventId: string,
  session: DbSession,
): Promise<void> {
  await Household.updateMany(
    { weddingId: oid(weddingId), invitedEventIds: oid(eventId) },
    { $pull: { invitedEventIds: oid(eventId) } },
    { session },
  ).exec();
}

// Guests

interface GuestDoc {
  _id: Types.ObjectId;
  householdId: Types.ObjectId;
  name: string;
  phone?: string | null;
  email?: string | null;
  relation?: string | null;
  isChild?: boolean;
}

function toGuest(d: GuestDoc): GuestDto {
  return {
    id: d._id.toString(),
    householdId: d.householdId.toString(),
    name: d.name,
    phone: d.phone ?? null,
    email: d.email ?? null,
    relation: d.relation ?? null,
    isChild: d.isChild ?? false,
  };
}

export async function listGuests(weddingId: string, householdIds?: string[]): Promise<GuestDto[]> {
  const query: Record<string, unknown> = { weddingId: oid(weddingId) };
  if (householdIds) query.householdId = { $in: oids(householdIds) };
  const docs = await Guest.find(query).sort({ _id: 1 }).lean<GuestDoc[]>().exec();
  return docs.map(toGuest);
}

export async function findGuest(weddingId: string, guestId: string): Promise<GuestDto | null> {
  if (!Types.ObjectId.isValid(guestId)) return null;
  const doc = await Guest.findOne({ weddingId: oid(weddingId), _id: oid(guestId) })
    .lean<GuestDoc>()
    .exec();
  return doc ? toGuest(doc) : null;
}

export interface NewGuest {
  id: string;
  householdId: string;
  name: string;
  phone: string | null;
  email: string | null;
  relation: string | null;
  isChild: boolean;
  importBatchId: string | null;
}

export async function insertGuests(
  weddingId: string,
  guests: NewGuest[],
  session?: DbSession,
): Promise<void> {
  if (guests.length === 0) return;
  await Guest.insertMany(
    guests.map(({ id, ...g }) => ({
      ...g,
      _id: oid(id),
      weddingId: oid(weddingId),
      householdId: oid(g.householdId),
    })),
    { session },
  );
}

export async function updateGuest(
  weddingId: string,
  guestId: string,
  changes: Record<string, unknown>,
): Promise<GuestDto | null> {
  const doc = await Guest.findOneAndUpdate(
    { weddingId: oid(weddingId), _id: oid(guestId) },
    { $set: changes },
    { returnDocument: "after", runValidators: true },
  )
    .lean<GuestDoc>()
    .exec();
  return doc ? toGuest(doc) : null;
}

export async function deleteGuest(weddingId: string, guestId: string): Promise<void> {
  await Guest.deleteOne({ weddingId: oid(weddingId), _id: oid(guestId) }).exec();
}

/** Existing guests with any of these phones (the CSV duplicate check). */
export async function findGuestsByPhone(
  weddingId: string,
  phones: string[],
): Promise<{ phone: string; name: string }[]> {
  if (phones.length === 0) return [];
  const docs = await Guest.find({ weddingId: oid(weddingId), phone: { $in: phones } })
    .select({ phone: 1, name: 1 })
    .lean<{ phone: string; name: string }[]>()
    .exec();
  return docs.map((d) => ({ phone: d.phone, name: d.name }));
}

// RSVPs

interface RsvpDoc {
  householdId: Types.ObjectId;
  eventId: Types.ObjectId;
  attending: boolean;
  headcount: number;
  source: "guest" | "organizer";
  respondedAt: Date;
}

export type RsvpRecord = RsvpDto & { householdId: string };

function toRsvp(d: RsvpDoc): RsvpRecord {
  return {
    householdId: d.householdId.toString(),
    eventId: d.eventId.toString(),
    attending: d.attending,
    headcount: d.headcount,
    source: d.source,
    respondedAt: d.respondedAt.toISOString(),
  };
}

export async function listRsvps(weddingId: string, householdIds?: string[]): Promise<RsvpRecord[]> {
  const query: Record<string, unknown> = { weddingId: oid(weddingId) };
  if (householdIds) query.householdId = { $in: oids(householdIds) };
  const docs = await Rsvp.find(query).lean<RsvpDoc[]>().exec();
  return docs.map(toRsvp);
}

/** One answer per household and event: a changed answer overwrites the old one. */
export async function upsertRsvp(
  weddingId: string,
  householdId: string,
  answer: { eventId: string; attending: boolean; headcount: number; source: "guest" | "organizer" },
  session?: DbSession,
): Promise<RsvpRecord> {
  const doc = await Rsvp.findOneAndUpdate(
    { weddingId: oid(weddingId), householdId: oid(householdId), eventId: oid(answer.eventId) },
    {
      $set: {
        attending: answer.attending,
        headcount: answer.headcount,
        source: answer.source,
        respondedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: "after", session },
  )
    .lean<RsvpDoc>()
    .orFail()
    .exec();
  return toRsvp(doc);
}

export async function deleteRsvp(
  weddingId: string,
  householdId: string,
  eventId: string,
): Promise<void> {
  await Rsvp.deleteOne({
    weddingId: oid(weddingId),
    householdId: oid(householdId),
    eventId: oid(eventId),
  }).exec();
}

/** Drops answers for events the household is no longer invited to. */
export async function deleteRsvpsOutside(
  weddingId: string,
  householdId: string,
  invitedEventIds: string[],
  session: DbSession,
): Promise<void> {
  await Rsvp.deleteMany(
    {
      weddingId: oid(weddingId),
      householdId: oid(householdId),
      eventId: { $nin: oids(invitedEventIds) },
    },
    { session },
  ).exec();
}

export async function deleteRsvpsForEvent(
  weddingId: string,
  eventId: string,
  session: DbSession,
): Promise<number> {
  const result = await Rsvp.deleteMany(
    { weddingId: oid(weddingId), eventId: oid(eventId) },
    { session },
  ).exec();
  return result.deletedCount;
}

export async function countRsvpsForEvent(weddingId: string, eventId: string): Promise<number> {
  return Rsvp.countDocuments({ weddingId: oid(weddingId), eventId: oid(eventId) }).exec();
}

/**
 * Per-event counts from two simple pipelines merged in code, so each stays on
 * its own index (Database Design, "RSVP summary per event"). `sides` limits
 * both to an organizer's side.
 */
export async function rsvpSummary(
  weddingId: string,
  sides?: HouseholdSide[],
): Promise<EventRsvpSummaryDto[]> {
  const w = oid(weddingId);
  const householdMatch: Record<string, unknown> = { weddingId: w };
  const rsvpMatch: Record<string, unknown> = { weddingId: w };
  if (sides) {
    householdMatch.side = { $in: sides };
    const ids = await Household.find(householdMatch)
      .select({ _id: 1 })
      .lean<{ _id: Types.ObjectId }[]>()
      .exec();
    rsvpMatch.householdId = { $in: ids.map((h) => h._id) };
  }
  const [invited, answered] = await Promise.all([
    Household.aggregate<{ _id: Types.ObjectId; households: number; headcount: number }>([
      { $match: householdMatch },
      { $unwind: "$invitedEventIds" },
      {
        $group: {
          _id: "$invitedEventIds",
          households: { $sum: 1 },
          headcount: { $sum: "$maxHeadcount" },
        },
      },
    ]),
    Rsvp.aggregate<{ _id: Types.ObjectId; attending: number; declined: number; headcount: number }>(
      [
        { $match: rsvpMatch },
        {
          $group: {
            _id: "$eventId",
            attending: { $sum: { $cond: ["$attending", 1, 0] } },
            declined: { $sum: { $cond: ["$attending", 0, 1] } },
            headcount: { $sum: "$headcount" },
          },
        },
      ],
    ),
  ]);
  const byEvent = new Map(answered.map((a) => [a._id.toString(), a]));
  return invited.map((i) => {
    const a = byEvent.get(i._id.toString());
    const attending = a?.attending ?? 0;
    const declined = a?.declined ?? 0;
    return {
      eventId: i._id.toString(),
      invitedHouseholds: i.households,
      invitedHeadcount: i.headcount,
      attendingHouseholds: attending,
      declinedHouseholds: declined,
      pendingHouseholds: Math.max(0, i.households - attending - declined),
      attendingHeadcount: a?.headcount ?? 0,
    };
  });
}

// CSV import batches

export async function findBatchHouseholds(
  weddingId: string,
  importBatchId: string,
): Promise<HouseholdRecord[]> {
  const docs = await Household.find({ weddingId: oid(weddingId), importBatchId })
    .lean<HouseholdDoc[]>()
    .exec();
  return docs.map(toHousehold);
}

/** Removes everything one import created; returns the households removed. */
export async function deleteBatch(
  weddingId: string,
  householdIds: string[],
  session: DbSession,
): Promise<number> {
  const w = oid(weddingId);
  const ids = oids(householdIds);
  await Guest.deleteMany({ weddingId: w, householdId: { $in: ids } }, { session }).exec();
  await Rsvp.deleteMany({ weddingId: w, householdId: { $in: ids } }, { session }).exec();
  const result = await Household.deleteMany(
    { weddingId: w, _id: { $in: ids } },
    { session },
  ).exec();
  return result.deletedCount;
}

// Message templates

export async function findTemplates(weddingId: string): Promise<Templates | null> {
  const doc = await MessageTemplate.findOne({ weddingId: oid(weddingId) })
    .lean<Templates>()
    .exec();
  return doc ? { invite: doc.invite, reminder: doc.reminder, eventDay: doc.eventDay } : null;
}

export async function saveTemplates(weddingId: string, templates: Templates): Promise<void> {
  await MessageTemplate.updateOne(
    { weddingId: oid(weddingId) },
    { $set: templates },
    { upsert: true, runValidators: true },
  ).exec();
}
