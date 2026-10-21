import "server-only";

import { Schema } from "mongoose";

import { defineModel } from "@/lib/db/model";
import { tenantGuard } from "@/lib/db/tenant-guard";

import { PRIORITIES, TASK_STATUSES } from "./schema";

// A shared to-do. boardOrder is a fractional position within its status
// column, so a drag rewrites one document (Database Design, "tasks").
const taskSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: null },
    status: { type: String, enum: TASK_STATUSES, required: true, default: "todo" },
    priority: { type: String, enum: PRIORITIES, required: true, default: "medium" },
    assigneeId: { type: Schema.Types.ObjectId, default: null },
    eventId: { type: Schema.Types.ObjectId, default: null },
    dueAt: { type: Date, default: null },
    boardOrder: { type: Number, required: true },
    createdBy: { type: Schema.Types.ObjectId, required: true },
    completedAt: { type: Date, default: null },
  },
  { collection: "tasks", timestamps: true, strict: true },
);
taskSchema.plugin(tenantGuard);

export const Task = defineModel("Task", taskSchema);
