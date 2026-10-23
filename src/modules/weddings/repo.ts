import "server-only";

import { Types } from "mongoose";

import type { DbSession } from "@/lib/db/connect";
import { formatDateOnly, parseDateOnly } from "@/lib/dates";

import { Wedding } from "./model";
import type { CreateWeddingInput, UpdateWeddingInput } from "./schema";
import type { WeddingDto } from "./types";

// `weddings` is the tenant root, so it isn't tenant-guarded; every query here
// is keyed by the wedding's own _id (or its unique slug).

const oid = (id: string) => new Types.ObjectId(id);

interface WeddingDoc {
  _id: Types.ObjectId;
  brideName: string;
  groomName: string;
  primaryDate: Date;
  city: string;
  tradition?: string | null;
  timezone: string;
  slug: string;
  rsvpDeadline?: Date | null;
  deletedAt?: Date | null;
}

function toDto(doc: WeddingDoc): WeddingDto {
  return {
    id: doc._id.toString(),
    brideName: doc.brideName,
    groomName: doc.groomName,
    primaryDate: formatDateOnly(doc.primaryDate),
    city: doc.city,
    tradition: doc.tradition ?? null,
    timezone: doc.timezone,
    slug: doc.slug,
    rsvpDeadline: doc.rsvpDeadline ? formatDateOnly(doc.rsvpDeadline) : null,
    deletedAt: doc.deletedAt ? doc.deletedAt.toISOString() : null,
  };
}

export async function insertWedding(
  input: CreateWeddingInput,
  createdBy: string,
  session: DbSession,
): Promise<WeddingDto> {
  const [doc] = await Wedding.create(
    [
      {
        brideName: input.brideName,
        groomName: input.groomName,
        primaryDate: parseDateOnly(input.primaryDate),
        city: input.city,
        tradition: input.tradition,
        slug: input.slug,
        createdBy: oid(createdBy),
      },
    ],
    { session },
  );
  if (!doc) throw new Error("Wedding insert returned nothing");
  return toDto(doc.toObject());
}

export async function findWedding(weddingId: string): Promise<WeddingDto | null> {
  if (!Types.ObjectId.isValid(weddingId)) return null;
  const doc = await Wedding.findById(weddingId).lean<WeddingDoc>().exec();
  return doc ? toDto(doc) : null;
}

export async function findWeddings(weddingIds: string[]): Promise<WeddingDto[]> {
  if (weddingIds.length === 0) return [];
  const docs = await Wedding.find({ _id: { $in: weddingIds.map(oid) } })
    .sort({ primaryDate: 1 })
    .lean<WeddingDoc[]>()
    .exec();
  return docs.map(toDto);
}

export async function slugTaken(slug: string, exceptWeddingId?: string): Promise<boolean> {
  const filter: Record<string, unknown> = { slug };
  if (exceptWeddingId) filter._id = { $ne: oid(exceptWeddingId) };
  return (await Wedding.exists(filter).exec()) !== null;
}

export async function updateWedding(
  weddingId: string,
  input: UpdateWeddingInput,
): Promise<WeddingDto | null> {
  const set: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === null) unset[key] = "";
    else if (key === "primaryDate" || key === "rsvpDeadline") set[key] = parseDateOnly(value);
    else set[key] = value;
  }
  const doc = await Wedding.findOneAndUpdate(
    { _id: oid(weddingId), deletedAt: null },
    {
      ...(Object.keys(set).length ? { $set: set } : {}),
      ...(Object.keys(unset).length ? { $unset: unset } : {}),
    },
    { returnDocument: "after", runValidators: true },
  )
    .lean<WeddingDoc>()
    .exec();
  return doc ? toDto(doc) : null;
}

export async function setDeletedAt(weddingId: string, at: Date | null): Promise<void> {
  await Wedding.updateOne(
    { _id: oid(weddingId) },
    at ? { $set: { deletedAt: at } } : { $unset: { deletedAt: "" } },
  ).exec();
}

// Wedding website

export interface WebsiteRecord {
  published: boolean;
  story: string;
  passwordHash: string | null;
  indexable: boolean;
  publishedAt: string | null;
}

interface WebsiteDoc {
  website?: {
    published?: boolean;
    story?: string;
    passwordHash?: string | null;
    indexable?: boolean;
    publishedAt?: Date | null;
  } | null;
}

function toWebsite(doc: WebsiteDoc): WebsiteRecord {
  const w = doc.website ?? {};
  return {
    published: w.published ?? false,
    story: w.story ?? "",
    passwordHash: w.passwordHash ?? null,
    indexable: w.indexable ?? false,
    publishedAt: w.publishedAt ? w.publishedAt.toISOString() : null,
  };
}

export async function findWebsite(weddingId: string): Promise<WebsiteRecord | null> {
  const doc = await Wedding.findOne({ _id: oid(weddingId), deletedAt: null })
    .select({ website: 1 })
    .lean<WebsiteDoc>()
    .exec();
  return doc ? toWebsite(doc) : null;
}

/** The public site's lookup by its address; deleted weddings never match. */
export async function findWeddingBySlug(
  slug: string,
): Promise<{ wedding: WeddingDto; website: WebsiteRecord } | null> {
  const doc = await Wedding.findOne({ slug: slug.toLowerCase(), deletedAt: null })
    .lean<WeddingDoc & WebsiteDoc>()
    .exec();
  return doc ? { wedding: toDto(doc), website: toWebsite(doc) } : null;
}

export async function updateWebsite(
  weddingId: string,
  changes: {
    published?: boolean | undefined;
    story?: string | undefined;
    passwordHash?: string | null | undefined;
    indexable?: boolean | undefined;
    publishedAt?: Date | undefined;
  },
): Promise<WebsiteRecord | null> {
  const set: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  for (const [key, value] of Object.entries(changes) as [string, unknown][]) {
    if (value === undefined) continue;
    if (value === null) unset[`website.${key}`] = "";
    else set[`website.${key}`] = value;
  }
  const doc = await Wedding.findOneAndUpdate(
    { _id: oid(weddingId), deletedAt: null },
    {
      ...(Object.keys(set).length ? { $set: set } : {}),
      ...(Object.keys(unset).length ? { $unset: unset } : {}),
    },
    { returnDocument: "after", runValidators: true },
  )
    .select({ website: 1 })
    .lean<WebsiteDoc>()
    .exec();
  return doc ? toWebsite(doc) : null;
}
