import "server-only";

import mongoose, { Types } from "mongoose";

import type { DbSession } from "@/lib/db/connect";

import { Invite, Membership } from "./model";
import type { Role, Side } from "./permissions";
import type { InviteDto, MembershipRecord } from "./types";

const oid = (id: string) => new Types.ObjectId(id);

interface MembershipDoc {
  weddingId: Types.ObjectId;
  userId: Types.ObjectId;
  role: Role;
  side: Side;
  joinedAt: Date;
}

function toMembership(doc: MembershipDoc): MembershipRecord {
  return {
    weddingId: doc.weddingId.toString(),
    userId: doc.userId.toString(),
    role: doc.role,
    side: doc.side,
    joinedAt: doc.joinedAt.toISOString(),
  };
}

export async function findMembership(
  weddingId: string,
  userId: string,
): Promise<MembershipRecord | null> {
  const doc = await Membership.findOne({ weddingId: oid(weddingId), userId: oid(userId) })
    .lean<MembershipDoc>()
    .exec();
  return doc ? toMembership(doc) : null;
}

export async function insertMembership(
  input: { weddingId: string; userId: string; role: Role; side: Side; invitedBy: string | null },
  session?: DbSession,
): Promise<MembershipRecord> {
  const [doc] = await Membership.create(
    [
      {
        weddingId: oid(input.weddingId),
        userId: oid(input.userId),
        role: input.role,
        side: input.side,
        invitedBy: input.invitedBy ? oid(input.invitedBy) : null,
        joinedAt: new Date(),
      },
    ],
    { session },
  );
  if (!doc) throw new Error("Membership insert returned nothing");
  return toMembership(doc.toObject());
}

export async function listMemberships(weddingId: string): Promise<MembershipRecord[]> {
  const docs = await Membership.find({ weddingId: oid(weddingId) })
    .sort({ joinedAt: 1 })
    .lean<MembershipDoc[]>()
    .exec();
  return docs.map(toMembership);
}

/** Every wedding a user belongs to. Cross-tenant by nature: keyed by the user. */
export async function listMembershipsForUser(userId: string): Promise<MembershipRecord[]> {
  const docs = await Membership.find({ userId: oid(userId) })
    .setOptions({ tenantScope: "global" })
    .lean<MembershipDoc[]>()
    .exec();
  return docs.map(toMembership);
}

export async function countOwners(weddingId: string): Promise<number> {
  return Membership.countDocuments({ weddingId: oid(weddingId), role: "owner" }).exec();
}

export async function updateMembership(
  weddingId: string,
  userId: string,
  patch: { role?: Role | undefined; side?: Side | undefined },
): Promise<MembershipRecord | null> {
  const set: Record<string, string> = {};
  if (patch.role) set.role = patch.role;
  if (patch.side) set.side = patch.side;
  const doc = await Membership.findOneAndUpdate(
    { weddingId: oid(weddingId), userId: oid(userId) },
    { $set: set },
    { returnDocument: "after" },
  )
    .lean<MembershipDoc>()
    .exec();
  return doc ? toMembership(doc) : null;
}

export async function deleteMembership(weddingId: string, userId: string): Promise<boolean> {
  const res = await Membership.deleteOne({ weddingId: oid(weddingId), userId: oid(userId) }).exec();
  return res.deletedCount === 1;
}

/** Removes a user from every wedding (account deletion). */
export async function deleteMembershipsForUser(userId: string): Promise<void> {
  await Membership.deleteMany({ userId: oid(userId) })
    .setOptions({ tenantScope: "global" })
    .exec();
}

/**
 * Names and emails from Better Auth's `user` collection. The app only ever
 * reads it; Better Auth owns the writes.
 */
export async function findUsers(
  userIds: string[],
): Promise<Map<string, { name: string; email: string }>> {
  const db = mongoose.connection.db;
  if (!db || userIds.length === 0) return new Map();
  const docs = await db
    .collection<{ _id: Types.ObjectId; name: string; email: string }>("user")
    .find({ _id: { $in: userIds.map(oid) } }, { projection: { name: 1, email: 1 } })
    .toArray();
  return new Map(docs.map((d) => [d._id.toString(), { name: d.name, email: d.email }]));
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const db = mongoose.connection.db;
  if (!db) return null;
  const doc = await db
    .collection<{ _id: Types.ObjectId }>("user")
    .findOne({ email: email.toLowerCase() }, { projection: { _id: 1 } });
  return doc ? doc._id.toString() : null;
}

// Invites

interface InviteDoc {
  _id: Types.ObjectId;
  weddingId: Types.ObjectId;
  email: string;
  role: Role;
  side: Side;
  status: InviteDto["status"];
  expiresAt: Date;
  createdAt: Date;
}

export interface InviteRecord extends InviteDto {
  weddingId: string;
}

function toInvite(doc: InviteDoc): InviteRecord {
  return {
    id: doc._id.toString(),
    weddingId: doc.weddingId.toString(),
    email: doc.email,
    role: doc.role,
    side: doc.side,
    status: doc.status,
    expiresAt: doc.expiresAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function insertInvite(input: {
  weddingId: string;
  email: string;
  role: Role;
  side: Side;
  tokenHash: string;
  invitedBy: string;
  expiresAt: Date;
}): Promise<InviteRecord> {
  const doc = await Invite.create({
    ...input,
    weddingId: oid(input.weddingId),
    invitedBy: oid(input.invitedBy),
  });
  return toInvite(doc.toObject());
}

/** Pending, unexpired invites for one wedding, newest first. */
export async function listPendingInvites(weddingId: string, now: Date): Promise<InviteRecord[]> {
  const docs = await Invite.find({
    weddingId: oid(weddingId),
    status: "pending",
    expiresAt: { $gt: now },
  })
    .sort({ createdAt: -1 })
    .lean<InviteDoc[]>()
    .exec();
  return docs.map(toInvite);
}

/** Looks an invite up by its token hash, before the wedding is known. */
export async function findInviteByHash(tokenHash: string): Promise<InviteRecord | null> {
  const doc = await Invite.findOne({ tokenHash })
    .setOptions({ tenantScope: "global" })
    .lean<InviteDoc>()
    .exec();
  return doc ? toInvite(doc) : null;
}

export async function revokeInvite(weddingId: string, inviteId: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(inviteId)) return false;
  const res = await Invite.updateOne(
    { weddingId: oid(weddingId), _id: oid(inviteId), status: "pending" },
    { $set: { status: "revoked" } },
  ).exec();
  return res.modifiedCount === 1;
}

/** Retires earlier pending invites to the same address, so only the newest link works. */
export async function revokePendingInvitesFor(weddingId: string, email: string): Promise<void> {
  await Invite.updateMany(
    { weddingId: oid(weddingId), email, status: "pending" },
    { $set: { status: "revoked" } },
  ).exec();
}

/** Marks an invite accepted if it's still pending. False when someone got there first. */
export async function markInviteAccepted(
  weddingId: string,
  inviteId: string,
  session: DbSession,
): Promise<boolean> {
  const res = await Invite.updateOne(
    { weddingId: oid(weddingId), _id: oid(inviteId), status: "pending" },
    { $set: { status: "accepted", acceptedAt: new Date() } },
    { session },
  ).exec();
  return res.modifiedCount === 1;
}
