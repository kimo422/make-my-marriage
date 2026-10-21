import "server-only";

import { Schema } from "mongoose";

import { defineModel } from "@/lib/db/model";
import { tenantGuard } from "@/lib/db/tenant-guard";

import { ROLES, SIDES } from "./permissions";

// A user's role in one wedding. Membership, not the account, decides access.
const membershipSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    role: { type: String, enum: ROLES, required: true },
    side: { type: String, enum: SIDES, required: true, default: "both" },
    invitedBy: { type: Schema.Types.ObjectId, default: null },
    joinedAt: { type: Date, required: true, default: () => new Date() },
  },
  { collection: "memberships", timestamps: true, strict: true },
);
membershipSchema.plugin(tenantGuard);

// A shareable invite link. Only the token's hash is stored.
const inviteSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ROLES, required: true },
    side: { type: String, enum: SIDES, required: true },
    tokenHash: { type: String, required: true },
    invitedBy: { type: Schema.Types.ObjectId, required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "revoked"],
      required: true,
      default: "pending",
    },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date },
  },
  { collection: "invites", timestamps: true, strict: true },
);
inviteSchema.plugin(tenantGuard);

export const Membership = defineModel("Membership", membershipSchema);
export const Invite = defineModel("Invite", inviteSchema);
