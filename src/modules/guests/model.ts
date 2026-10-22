import "server-only";

import { Schema } from "mongoose";

import { defineModel } from "@/lib/db/model";
import { tenantGuard } from "@/lib/db/tenant-guard";

import { HOUSEHOLD_SIDES, MAX_HEADCOUNT, MESSAGE_STATES } from "./schema";

const messageSchema = new Schema(
  {
    state: { type: String, enum: MESSAGE_STATES, required: true, default: "not_sent" },
    sentAt: { type: Date, default: null },
    sentBy: { type: Schema.Types.ObjectId, default: null },
    firstOpenedAt: { type: Date, default: null },
    lastReminderAt: { type: Date, default: null },
    reminderCount: { type: Number, default: 0 },
  },
  { _id: false },
);

// A family: the unit that is invited, messaged on WhatsApp and answers the RSVP.
const householdSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    side: { type: String, enum: HOUSEHOLD_SIDES, required: true },
    group: { type: String, trim: true, maxlength: 60, default: null },
    maxHeadcount: { type: Number, required: true, min: 1, max: MAX_HEADCOUNT },
    invitedEventIds: { type: [Schema.Types.ObjectId], default: [] },
    // SHA-256 of the derived RSVP token; rebuilt from the id and this version.
    rsvpTokenHash: { type: String, required: true },
    rsvpTokenVersion: { type: Number, required: true, default: 1 },
    primaryGuestId: { type: Schema.Types.ObjectId, default: null },
    message: { type: messageSchema, default: () => ({}) },
    notes: { type: String, trim: true, maxlength: 1000, default: null },
    importBatchId: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, required: true },
  },
  { collection: "households", timestamps: true, strict: true },
);
householdSchema.plugin(tenantGuard);

// A person inside a household. Contact details are visible to the planning team only.
const guestSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, required: true },
    householdId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, default: null },
    email: { type: String, lowercase: true, trim: true, default: null },
    relation: { type: String, trim: true, maxlength: 80, default: null },
    isChild: { type: Boolean, default: false },
    importBatchId: { type: String, default: null },
  },
  { collection: "guests", timestamps: true, strict: true },
);
guestSchema.plugin(tenantGuard);

// One answer per household per event, overwritten when it changes.
const rsvpSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, required: true },
    householdId: { type: Schema.Types.ObjectId, required: true },
    eventId: { type: Schema.Types.ObjectId, required: true },
    attending: { type: Boolean, required: true },
    headcount: { type: Number, required: true, min: 0, max: MAX_HEADCOUNT },
    source: { type: String, enum: ["guest", "organizer"], required: true },
    respondedAt: { type: Date, required: true },
  },
  { collection: "rsvps", timestamps: true, strict: true },
);
rsvpSchema.plugin(tenantGuard);

// The wedding's WhatsApp message wording (decision 7a: one set per wedding).
const messageTemplateSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, required: true },
    invite: { type: String, required: true, maxlength: 1000 },
    reminder: { type: String, required: true, maxlength: 1000 },
    eventDay: { type: String, required: true, maxlength: 1000 },
  },
  { collection: "messageTemplates", timestamps: true, strict: true },
);
messageTemplateSchema.plugin(tenantGuard);

export const Household = defineModel("Household", householdSchema);
export const Guest = defineModel("Guest", guestSchema);
export const Rsvp = defineModel("Rsvp", rsvpSchema);
export const MessageTemplate = defineModel("MessageTemplate", messageTemplateSchema);
