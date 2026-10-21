import "server-only";

import { Schema } from "mongoose";

import { defineModel } from "@/lib/db/model";
import { tenantGuard } from "@/lib/db/tenant-guard";

import { EVENT_TYPES } from "./schema";

const venueSchema = new Schema(
  {
    name: { type: String, trim: true, maxlength: 120, default: null },
    address: { type: String, trim: true, maxlength: 300, default: null },
    mapUrl: { type: String, trim: true, maxlength: 500, default: null },
  },
  { _id: false },
);

// One function of the wedding (Haldi, Sangeet, …). `order` is the dashboard
// order: chronological when created, then whatever the planners set.
const eventSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    type: { type: String, enum: EVENT_TYPES, required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    venue: { type: venueSchema, default: () => ({}) },
    dressCode: { type: String, trim: true, maxlength: 120, default: null },
    notes: { type: String, trim: true, maxlength: 1000, default: null },
    isPublic: { type: Boolean, default: true },
    order: { type: Number, required: true },
  },
  { collection: "events", timestamps: true, strict: true },
);
eventSchema.plugin(tenantGuard);

export const Event = defineModel("Event", eventSchema);
