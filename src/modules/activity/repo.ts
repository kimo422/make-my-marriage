import "server-only";

import { Types } from "mongoose";

import type { DbSession } from "@/lib/db/connect";

import { Activity } from "./model";
import type { ActivityAction, ActivityDto, ActivityEntity } from "./types";

const oid = (id: string) => new Types.ObjectId(id);

export interface NewActivity {
  weddingId: string;
  actorId: string | null;
  actorLabel: string;
  action: ActivityAction;
  entity: ActivityEntity;
  entityId: string;
  summary: string;
}

export async function insertActivity(entry: NewActivity, session?: DbSession): Promise<void> {
  await Activity.create(
    [
      {
        ...entry,
        weddingId: oid(entry.weddingId),
        actorId: entry.actorId ? oid(entry.actorId) : null,
        entityId: oid(entry.entityId),
        summary: entry.summary.slice(0, 200),
        actorLabel: entry.actorLabel.slice(0, 80),
      },
    ],
    { session },
  );
}

interface ActivityDoc {
  _id: Types.ObjectId;
  actorLabel: string;
  action: ActivityAction;
  entity: ActivityEntity;
  entityId: Types.ObjectId;
  summary: string;
  at: Date;
}

/** Newest first, cursor-paged on _id (Database Design, "Key queries"). */
export async function listActivity(
  weddingId: string,
  page: { limit: number; cursor?: string | undefined },
): Promise<{ items: ActivityDto[]; nextCursor: string | null }> {
  const filter: Record<string, unknown> = { weddingId: oid(weddingId) };
  if (page.cursor) filter._id = { $lt: oid(page.cursor) };
  const docs = await Activity.find(filter)
    .sort({ _id: -1 })
    .limit(page.limit + 1)
    .lean<ActivityDoc[]>()
    .exec();
  const items = docs.slice(0, page.limit).map((d) => ({
    id: d._id.toString(),
    actorLabel: d.actorLabel,
    action: d.action,
    entity: d.entity,
    entityId: d.entityId.toString(),
    summary: d.summary,
    at: d.at.toISOString(),
  }));
  const last = items.at(-1);
  return { items, nextCursor: docs.length > page.limit && last ? last.id : null };
}
