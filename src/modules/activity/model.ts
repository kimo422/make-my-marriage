import "server-only";

import { Schema } from "mongoose";

import { defineModel } from "@/lib/db/model";
import { tenantGuard } from "@/lib/db/tenant-guard";

export const ACTIVITY_ACTIONS = [
  "created",
  "updated",
  "deleted",
  "invited",
  "rsvped",
  "uploaded",
  "moderated",
  "regenerated_link",
] as const;

export const ACTIVITY_ENTITIES = [
  "wedding",
  "event",
  "task",
  "household",
  "guest",
  "member",
  "photo",
  "gallery",
] as const;

// Append-only audit trail ("Priya added 12 guests"). Never holds guest contact
// details; a TTL index removes entries after 150 days.
const activitySchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, required: true },
    actorId: { type: Schema.Types.ObjectId, default: null },
    actorLabel: { type: String, required: true, maxlength: 80 },
    action: { type: String, enum: ACTIVITY_ACTIONS, required: true },
    entity: { type: String, enum: ACTIVITY_ENTITIES, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    summary: { type: String, required: true, maxlength: 200 },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { collection: "activity", strict: true },
);
activitySchema.plugin(tenantGuard);

export const Activity = defineModel("Activity", activitySchema);
