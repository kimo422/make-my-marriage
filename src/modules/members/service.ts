import "server-only";

import type { SessionUser } from "@/lib/auth/session";
import type { DbSession } from "@/lib/db/connect";
import { env } from "@/lib/env/server";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { hashToken, randomToken } from "@/lib/tokens";
import { logActivity } from "@/modules/activity";

import { can, ROLE_LABELS, type Permission } from "./permissions";
import * as repo from "./repo";
import type { CreateInviteInput, UpdateMemberInput } from "./schema";
import type { CreatedInviteDto, InviteDto, MemberDto, MembershipRecord } from "./types";

const INVITE_DAYS = 7;

/** Who is acting, and as what, in one wedding. Built by weddings.requireAccess(). */
export interface MemberContext {
  user: SessionUser;
  membership: MembershipRecord;
}

export function getMembership(weddingId: string, userId: string) {
  return repo.findMembership(weddingId, userId);
}

export function assertCan(ctx: MemberContext, permission: Permission): void {
  if (!can(ctx.membership.role, permission)) throw forbidden();
}

/** The wedding's creator becomes its first owner (inside the create-wedding transaction). */
export function addOwner(weddingId: string, userId: string, session: DbSession) {
  return repo.insertMembership(
    { weddingId, userId, role: "owner", side: "both", invitedBy: null },
    session,
  );
}

export async function listMembers(weddingId: string): Promise<MemberDto[]> {
  return withProfiles(await repo.listMemberships(weddingId));
}

function log(
  ctx: MemberContext,
  entityId: string,
  action: "updated" | "deleted" | "invited",
  summary: string,
) {
  return logActivity({
    weddingId: ctx.membership.weddingId,
    actorId: ctx.user.id,
    actorLabel: ctx.user.name,
    action,
    entity: "member",
    entityId,
    summary,
  });
}

export async function changeMember(
  ctx: MemberContext,
  targetUserId: string,
  input: UpdateMemberInput,
): Promise<MemberDto> {
  assertCan(ctx, "members.manage");
  const { weddingId } = ctx.membership;
  const target = await repo.findMembership(weddingId, targetUserId);
  if (!target) throw notFound("Member not found");

  // Only owners can make someone an owner or change an owner.
  if (target.role === "owner" || input.role === "owner") assertCan(ctx, "members.manageOwners");

  const demotingOwner =
    target.role === "owner" && input.role !== undefined && input.role !== "owner";
  if (demotingOwner && (await repo.countOwners(weddingId)) <= 1) {
    throw new AppError(
      "LAST_OWNER",
      "A wedding needs at least one owner. Make someone else an owner first.",
    );
  }

  const updated = await repo.updateMembership(weddingId, targetUserId, input);
  if (!updated) throw notFound("Member not found");
  const [member] = await withProfiles([updated]);
  if (!member) throw notFound("Member not found");

  const what = input.role
    ? `made ${member.name} ${ROLE_LABELS[input.role].toLowerCase()}`
    : `updated ${member.name}`;
  await log(ctx, targetUserId, "updated", `${ctx.user.name} ${what}`);
  return member;
}

/** Removes a member, or lets anyone leave. The last owner can't go. */
export async function removeMember(ctx: MemberContext, targetUserId: string): Promise<void> {
  const { weddingId } = ctx.membership;
  const leaving = targetUserId === ctx.user.id;
  const target = leaving ? ctx.membership : await repo.findMembership(weddingId, targetUserId);
  if (!target) throw notFound("Member not found");

  if (!leaving) {
    assertCan(ctx, "members.manage");
    if (target.role === "owner") assertCan(ctx, "members.manageOwners");
  }
  if (target.role === "owner" && (await repo.countOwners(weddingId)) <= 1) {
    throw new AppError(
      "LAST_OWNER",
      "A wedding needs at least one owner. Make someone else an owner first.",
    );
  }

  const [profile] = await withProfiles([target]);
  await repo.deleteMembership(weddingId, targetUserId);
  await log(
    ctx,
    targetUserId,
    "deleted",
    leaving
      ? `${ctx.user.name} left the wedding`
      : `${ctx.user.name} removed ${profile?.name ?? "a member"}`,
  );
}

async function withProfiles(memberships: MembershipRecord[]): Promise<MemberDto[]> {
  const users = await repo.findUsers(memberships.map((m) => m.userId));
  return memberships.map((m) => ({
    ...m,
    name: users.get(m.userId)?.name ?? "Former member",
    email: users.get(m.userId)?.email ?? "",
  }));
}

// Invites

function publicInvite(invite: repo.InviteRecord): InviteDto {
  const { weddingId: _weddingId, ...dto } = invite;
  return dto;
}

export async function createInvite(
  ctx: MemberContext,
  input: CreateInviteInput,
): Promise<CreatedInviteDto> {
  assertCan(ctx, "members.manage");
  if (input.role === "owner") assertCan(ctx, "members.manageOwners");
  const { weddingId } = ctx.membership;

  const existingUserId = await repo.findUserIdByEmail(input.email);
  if (existingUserId && (await repo.findMembership(weddingId, existingUserId))) {
    throw new AppError("CONFLICT", "That person is already a member of this wedding.");
  }

  // One live link per address: a new invite retires the previous one.
  await repo.revokePendingInvitesFor(weddingId, input.email);
  const token = randomToken();
  const invite = await repo.insertInvite({
    weddingId,
    email: input.email,
    role: input.role,
    side: input.side,
    tokenHash: hashToken(token),
    invitedBy: ctx.user.id,
    expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
  });

  await log(
    ctx,
    invite.id,
    "invited",
    `${ctx.user.name} invited someone as ${ROLE_LABELS[input.role].toLowerCase()}`,
  );
  return { invite: publicInvite(invite), inviteUrl: `${env.APP_URL}/invites/${token}` };
}

export async function listInvites(weddingId: string): Promise<InviteDto[]> {
  return (await repo.listPendingInvites(weddingId, new Date())).map(publicInvite);
}

export async function revokeInvite(ctx: MemberContext, inviteId: string): Promise<void> {
  assertCan(ctx, "members.manage");
  if (!(await repo.revokeInvite(ctx.membership.weddingId, inviteId))) {
    throw notFound("Invite not found");
  }
}

/** A pending, unexpired invite for this token, or null. Never says why a token failed. */
export async function findOpenInvite(token: string): Promise<repo.InviteRecord | null> {
  const invite = await repo.findInviteByHash(hashToken(token));
  if (!invite || invite.status !== "pending" || new Date(invite.expiresAt) <= new Date())
    return null;
  return invite;
}

/**
 * Turns an open invite into a membership (inside a transaction). Only the
 * signed-in user whose email the invite was sent to can accept it.
 */
export async function acceptInvite(
  user: SessionUser,
  invite: repo.InviteRecord,
  session: DbSession,
): Promise<MembershipRecord> {
  if (user.email.toLowerCase() !== invite.email) {
    throw new AppError(
      "FORBIDDEN",
      "This invite was sent to a different email address. Sign in with that address to accept it.",
    );
  }
  if (await repo.findMembership(invite.weddingId, user.id)) {
    throw new AppError("CONFLICT", "You're already a member of this wedding.", {
      details: { weddingId: invite.weddingId },
    });
  }
  if (!(await repo.markInviteAccepted(invite.weddingId, invite.id, session))) {
    throw notFound("This invite is no longer valid");
  }
  const membership = await repo.insertMembership(
    {
      weddingId: invite.weddingId,
      userId: user.id,
      role: invite.role,
      side: invite.side,
      invitedBy: null,
    },
    session,
  );
  await logActivity(
    {
      weddingId: invite.weddingId,
      actorId: user.id,
      actorLabel: user.name,
      action: "created",
      entity: "member",
      entityId: user.id,
      summary: `${user.name} joined as ${ROLE_LABELS[invite.role].toLowerCase()}`,
    },
    session,
  );
  return membership;
}

export function listMembershipsForUser(userId: string) {
  return repo.listMembershipsForUser(userId);
}

export function countOwners(weddingId: string) {
  return repo.countOwners(weddingId);
}

export function removeAllMembershipsForUser(userId: string) {
  return repo.deleteMembershipsForUser(userId);
}
