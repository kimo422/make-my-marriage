import { z } from "zod";

import { isDateOnly } from "@/lib/dates";
import { objectId } from "@/lib/validation/common";

// Client-safe: shared by the task forms and handlers.

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const blankToNull = (v: unknown) => (v === "" ? null : v);
const nullableId = z.preprocess(blankToNull, objectId.nullable().optional());
const nullableDate = z.preprocess(
  blankToNull,
  z.string().refine(isDateOnly, "Enter a valid date").nullable().optional(),
);

const fields = {
  title: z.string().trim().min(1, "Give the task a title").max(120, "Keep it under 120 characters"),
  description: z.preprocess(blankToNull, z.string().trim().max(2000).nullable().optional()),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assigneeId: nullableId,
  eventId: nullableId,
  dueAt: nullableDate,
};

export const createTaskSchema = z.object(fields).strict();

export const updateTaskSchema = z
  .object({ ...fields, title: fields.title.optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to change" });

/** A drag on the board: the column it lands in and its new neighbours (API Design, "move"). */
export const moveTaskSchema = z
  .object({
    status: z.enum(TASK_STATUSES),
    beforeId: objectId.nullable(),
    afterId: objectId.nullable(),
  })
  .strict();

export const taskQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  /** A member's id, or "me". */
  assigneeId: z.union([objectId, z.literal("me")]).optional(),
  eventId: objectId.optional(),
  overdue: z.enum(["true", "false"]).optional(),
});

export const importChecklistSchema = z
  .object({
    /** null imports the general wedding checklist, dated from the main wedding date. */
    eventId: objectId.nullable(),
    itemIds: z.array(z.string().min(1).max(40)).min(1, "Tick at least one item").max(60),
  })
  .strict();

export const checklistQuerySchema = z.object({ eventId: objectId.optional() });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type TaskQuery = z.infer<typeof taskQuerySchema>;
