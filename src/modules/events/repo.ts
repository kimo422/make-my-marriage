import "server-only";

import { Types } from "mongoose";

import type { DbSession } from "@/lib/db/connect";

import { Event } from "./model";
import type { CreateEventInput, EventType, UpdateEventInput } from "./schema";
import type { EventDto } from "./types";

const oid = (id: string) => new Types.ObjectId(id);

interface EventDoc {
  _id: Types.ObjectId;
  name: string;
  type: EventType;
  startAt: Date;
  endAt: Date;
  venue?: { name?: string | null; address?: string | null; mapUrl?: string | null } | null;
  dressCode?: string | null;
  notes?: string | null;
  isPublic: boolean;
  order: number;
  updatedAt: Date;
}

function toDto(doc: EventDoc): EventDto {
  return {
    id: doc._id.toString(),
    name: doc.name,
    type: doc.type,
    startAt: doc.startAt.toISOString(),
    endAt: doc.endAt.toISOString(),
    venue: {
      name: doc.venue?.name ?? null,
      address: doc.venue?.address ?? null,
      mapUrl: doc.venue?.mapUrl ?? null,
    },
    dressCode: doc.dressCode ?? null,
    notes: doc.notes ?? null,
    isPublic: doc.isPublic,
    order: doc.order,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** Dashboard order (chronological unless planners reorder). */
export async function listEvents(weddingId: string): Promise<EventDto[]> {
  const docs = await Event.find({ weddingId: oid(weddingId) })
    .sort({ order: 1, startAt: 1 })
    .lean<EventDoc[]>()
    .exec();
  return docs.map(toDto);
}

export async function findEvent(weddingId: string, eventId: string): Promise<EventDto | null> {
  if (!Types.ObjectId.isValid(eventId)) return null;
  const doc = await Event.findOne({ weddingId: oid(weddingId), _id: oid(eventId) })
    .lean<EventDoc>()
    .exec();
  return doc ? toDto(doc) : null;
}

export async function countEvents(weddingId: string): Promise<number> {
  return Event.countDocuments({ weddingId: oid(weddingId) }).exec();
}

export async function insertEvent(
  weddingId: string,
  input: CreateEventInput,
  order: number,
): Promise<EventDto> {
  const doc = await Event.create({
    weddingId: oid(weddingId),
    name: input.name,
    type: input.type,
    startAt: new Date(input.startAt),
    endAt: new Date(input.endAt),
    venue: input.venue ?? {},
    dressCode: input.dressCode ?? null,
    notes: input.notes ?? null,
    isPublic: input.isPublic ?? true,
    order,
  });
  return toDto(doc.toObject());
}

/**
 * Rewrites `order` so the given ids come out in that sequence (1, 2, 3, …).
 * Leaves updatedAt alone: reordering isn't an edit, and bumping it would make
 * every planner's open copy "stale" for If-Match.
 */
export async function setOrder(weddingId: string, idsInOrder: string[]): Promise<void> {
  if (idsInOrder.length === 0) return;
  await Event.bulkWrite(
    idsInOrder.map((id, i) => ({
      updateOne: {
        filter: { weddingId: oid(weddingId), _id: oid(id) },
        update: { $set: { order: i + 1 } },
        timestamps: false,
      },
    })),
  );
}

export type UpdateOutcome =
  | { status: "updated"; event: EventDto }
  | { status: "conflict"; current: EventDto }
  | { status: "missing" };

/** Applies a partial update; with `ifMatch`, only when the stored updatedAt still matches. */
export async function updateEvent(
  weddingId: string,
  eventId: string,
  input: UpdateEventInput,
  ifMatch?: Date,
): Promise<UpdateOutcome> {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === "startAt" || key === "endAt") set[key] = new Date(value as string);
    else if (key === "venue") {
      for (const [field, v] of Object.entries(value as Record<string, unknown>)) {
        if (v !== undefined) set[`venue.${field}`] = v;
      }
    } else set[key] = value;
  }
  const filter: Record<string, unknown> = { weddingId: oid(weddingId), _id: oid(eventId) };
  if (ifMatch) filter.updatedAt = ifMatch;

  const doc = await Event.findOneAndUpdate(
    filter,
    { $set: set },
    { returnDocument: "after", runValidators: true },
  )
    .lean<EventDoc>()
    .exec();
  if (doc) return { status: "updated", event: toDto(doc) };
  const current = await findEvent(weddingId, eventId);
  return current ? { status: "conflict", current } : { status: "missing" };
}

export async function deleteEvent(
  weddingId: string,
  eventId: string,
  session: DbSession,
): Promise<boolean> {
  const res = await Event.deleteOne(
    { weddingId: oid(weddingId), _id: oid(eventId) },
    { session },
  ).exec();
  return res.deletedCount === 1;
}
