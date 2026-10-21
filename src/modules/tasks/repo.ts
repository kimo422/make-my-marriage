import "server-only";

import { Types } from "mongoose";

import type { DbSession } from "@/lib/db/connect";
import { formatDateOnly, parseDateOnly } from "@/lib/dates";

import { Task } from "./model";
import type { Priority, TaskStatus } from "./schema";
import type { TaskCountsDto, TaskDto } from "./types";

const oid = (id: string) => new Types.ObjectId(id);

interface TaskDoc {
  _id: Types.ObjectId;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: Priority;
  assigneeId?: Types.ObjectId | null;
  eventId?: Types.ObjectId | null;
  dueAt?: Date | null;
  boardOrder: number;
  createdBy: Types.ObjectId;
  completedAt?: Date | null;
  updatedAt: Date;
}

function toDto(doc: TaskDoc, today: string): TaskDto {
  const dueAt = doc.dueAt ? formatDateOnly(doc.dueAt) : null;
  return {
    id: doc._id.toString(),
    title: doc.title,
    description: doc.description ?? null,
    status: doc.status,
    priority: doc.priority,
    assigneeId: doc.assigneeId?.toString() ?? null,
    eventId: doc.eventId?.toString() ?? null,
    dueAt,
    boardOrder: doc.boardOrder,
    createdBy: doc.createdBy.toString(),
    completedAt: doc.completedAt?.toISOString() ?? null,
    updatedAt: doc.updatedAt.toISOString(),
    overdue: doc.status !== "done" && dueAt !== null && dueAt < today,
  };
}

export interface TaskFilter {
  status?: TaskStatus | undefined;
  assigneeId?: string | undefined;
  eventId?: string | undefined;
  /** Only open tasks due before this date ("YYYY-MM-DD"). */
  overdueBefore?: string | undefined;
}

/** Board order: by column, then position (Database Design, "Task board"). */
export async function listTasks(
  weddingId: string,
  filter: TaskFilter,
  today: string,
): Promise<TaskDto[]> {
  const query: Record<string, unknown> = { weddingId: oid(weddingId) };
  if (filter.status) query.status = filter.status;
  if (filter.assigneeId) query.assigneeId = oid(filter.assigneeId);
  if (filter.eventId) query.eventId = oid(filter.eventId);
  if (filter.overdueBefore) {
    query.status = { $ne: "done" };
    query.dueAt = { $lt: parseDateOnly(filter.overdueBefore) };
  }
  const docs = await Task.find(query).sort({ status: 1, boardOrder: 1 }).lean<TaskDoc[]>().exec();
  return docs.map((d) => toDto(d, today));
}

export async function findTask(
  weddingId: string,
  taskId: string,
  today: string,
): Promise<TaskDto | null> {
  if (!Types.ObjectId.isValid(taskId)) return null;
  const doc = await Task.findOne({ weddingId: oid(weddingId), _id: oid(taskId) })
    .lean<TaskDoc>()
    .exec();
  return doc ? toDto(doc, today) : null;
}

/** The last position in a column, so new and re-columned tasks land at the bottom. */
export async function maxBoardOrder(weddingId: string, status: TaskStatus): Promise<number> {
  const doc = await Task.findOne({ weddingId: oid(weddingId), status })
    .sort({ boardOrder: -1 })
    .select({ boardOrder: 1 })
    .lean<{ boardOrder: number }>()
    .exec();
  return doc?.boardOrder ?? 0;
}

export interface NewTask {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string | null;
  eventId: string | null;
  dueAt: string | null;
  boardOrder: number;
  createdBy: string;
}

function toDoc(weddingId: string, t: NewTask) {
  return {
    weddingId: oid(weddingId),
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assigneeId: t.assigneeId ? oid(t.assigneeId) : null,
    eventId: t.eventId ? oid(t.eventId) : null,
    dueAt: t.dueAt ? parseDateOnly(t.dueAt) : null,
    boardOrder: t.boardOrder,
    createdBy: oid(t.createdBy),
    completedAt: t.status === "done" ? new Date() : null,
  };
}

export async function insertTasks(
  weddingId: string,
  tasks: NewTask[],
  today: string,
): Promise<TaskDto[]> {
  const docs = await Task.insertMany(tasks.map((t) => toDoc(weddingId, t)));
  return docs.map((d) => toDto(d.toObject() as TaskDoc, today));
}

export interface TaskPatch {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string | null;
  eventId?: string | null;
  dueAt?: string | null;
  boardOrder?: number;
  completedAt?: Date | null;
}

export type UpdateOutcome =
  | { status: "updated"; task: TaskDto }
  | { status: "conflict"; current: TaskDto }
  | { status: "missing" };

export async function updateTask(
  weddingId: string,
  taskId: string,
  patch: TaskPatch,
  today: string,
  ifMatch?: Date,
): Promise<UpdateOutcome> {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if ((key === "assigneeId" || key === "eventId") && typeof value === "string")
      set[key] = oid(value);
    else if (key === "dueAt" && typeof value === "string") set[key] = parseDateOnly(value);
    else set[key] = value;
  }
  const filter: Record<string, unknown> = { weddingId: oid(weddingId), _id: oid(taskId) };
  if (ifMatch) filter.updatedAt = ifMatch;

  const doc = await Task.findOneAndUpdate(
    filter,
    { $set: set },
    { returnDocument: "after", runValidators: true },
  )
    .lean<TaskDoc>()
    .exec();
  if (doc) return { status: "updated", task: toDto(doc, today) };
  const current = await findTask(weddingId, taskId, today);
  return current ? { status: "conflict", current } : { status: "missing" };
}

/** Rewrites a column's positions as 1, 2, 3… once fractional gaps get too small. */
export async function renumberColumn(weddingId: string, status: TaskStatus): Promise<void> {
  const docs = await Task.find({ weddingId: oid(weddingId), status })
    .sort({ boardOrder: 1 })
    .select({ _id: 1 })
    .lean<{ _id: Types.ObjectId }[]>()
    .exec();
  if (docs.length === 0) return;
  await Task.bulkWrite(
    docs.map((d, i) => ({
      updateOne: {
        filter: { weddingId: oid(weddingId), _id: d._id },
        update: { $set: { boardOrder: i + 1 } },
        // Keep updatedAt: renumbering isn't an edit, and must not trip If-Match.
        timestamps: false,
      },
    })),
  );
}

export async function deleteTask(weddingId: string, taskId: string): Promise<boolean> {
  const res = await Task.deleteOne({ weddingId: oid(weddingId), _id: oid(taskId) }).exec();
  return res.deletedCount === 1;
}

export async function countTasksForEvent(weddingId: string, eventId: string): Promise<number> {
  return Task.countDocuments({ weddingId: oid(weddingId), eventId: oid(eventId) }).exec();
}

/** Deleting an event keeps its tasks but unlinks them (Database Design, "Delete event"). */
export async function unlinkEvent(
  weddingId: string,
  eventId: string,
  session: DbSession,
): Promise<number> {
  const res = await Task.updateMany(
    { weddingId: oid(weddingId), eventId: oid(eventId) },
    { $set: { eventId: null } },
    { session },
  ).exec();
  return res.modifiedCount;
}

export async function countTasks(weddingId: string, today: string): Promise<TaskCountsDto> {
  const rows = await Task.aggregate<{ _id: TaskStatus; n: number; overdue: number }>([
    { $match: { weddingId: oid(weddingId) } },
    {
      $group: {
        _id: "$status",
        n: { $sum: 1 },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$status", "done"] },
                  { $ne: ["$dueAt", null] },
                  { $lt: ["$dueAt", parseDateOnly(today)] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);
  const counts: TaskCountsDto = { todo: 0, in_progress: 0, done: 0, overdue: 0 };
  for (const r of rows) {
    counts[r._id] = r.n;
    counts.overdue += r.overdue;
  }
  return counts;
}
