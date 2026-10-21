import "server-only";

import { Schema } from "mongoose";

import { defineModel } from "@/lib/db/model";
import { DEFAULT_TIMEZONE } from "@/lib/dates";

// The tenant root. Website and gallery settings are embedded: small, always
// read together, never queried across weddings (Database Design, "weddings").

const websiteSchema = new Schema(
  {
    published: { type: Boolean, default: false },
    theme: { type: String, enum: ["traditional"], default: "traditional" },
    story: { type: String, maxlength: 2000, default: "" },
    passwordHash: { type: String },
    indexable: { type: Boolean, default: false },
    publishedAt: { type: Date },
  },
  { _id: false },
);

const gallerySchema = new Schema(
  {
    // Set in Phase 6, when gallery links are derived from TOKEN_SECRET.
    linkTokenHash: { type: String },
    linkVersion: { type: Number, default: 1 },
    pinHash: { type: String },
    uploadsOpen: { type: Boolean, default: true },
    uploadsCloseAt: { type: Date },
    reportHideThreshold: { type: Number, default: 3 },
    guestDownload: {
      type: String,
      enum: ["compressed", "originals", "none"],
      default: "compressed",
    },
    storageQuotaBytes: { type: Number, default: 2 * 1024 ** 3 },
    storageUsedBytes: { type: Number, default: 0 },
  },
  { _id: false },
);

const weddingSchema = new Schema(
  {
    brideName: { type: String, required: true, trim: true, maxlength: 60 },
    groomName: { type: String, required: true, trim: true, maxlength: 60 },
    primaryDate: { type: Date, required: true },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    tradition: { type: String, trim: true, maxlength: 40 },
    timezone: { type: String, default: DEFAULT_TIMEZONE },
    coverKey: { type: String },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 60 },
    rsvpDeadline: { type: Date },
    website: { type: websiteSchema, default: () => ({}) },
    gallery: { type: gallerySchema, default: () => ({}) },
    createdBy: { type: Schema.Types.ObjectId, required: true },
    deletedAt: { type: Date },
  },
  { collection: "weddings", timestamps: true, strict: true },
);

export const Wedding = defineModel("Wedding", weddingSchema);
