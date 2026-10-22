import "server-only";

import type { SessionUser } from "@/lib/auth/session";
import { withTransaction } from "@/lib/db/connect";
import { isDuplicateKeyError } from "@/lib/db/model";
import { AppError, notFound } from "@/lib/errors";
import { objectId } from "@/lib/validation/common";
import { daysUntil } from "@/lib/dates";
import { logActivity } from "@/modules/activity";
import { countWeddingEvents } from "@/modules/events";
import { rsvpSummary, type EventRsvpSummaryDto } from "@/modules/guests";
import { countWeddingTasks, type TaskCountsDto } from "@/modules/tasks";
import {
  acceptInvite as acceptMemberInvite,
  addOwner,
  assertCan,
  countOwners,
  findOpenInvite,
  getMembership,
  listMembershipsForUser,
  type MemberContext,
  type Permission,
  type Role,
  type Side,
} from "@/modules/members";

import * as repo from "./repo";
import { slugField, type CreateWeddingInput, type UpdateWeddingInput } from "./schema";
import type { MyWeddingDto, SlugAvailabilityDto, WeddingDto } from "./types";

/** An owner can restore a deleted wedding for this long; then the daily cron purges it. */
export const RESTORE_WINDOW_DAYS = 30;

export interface WeddingContext extends MemberContext {
  wedding: WeddingDto;
}

function withinRestoreWindow(deletedAt: string, now = Date.now()): boolean {
  return now - new Date(deletedAt).getTime() < RESTORE_WINDOW_DAYS * 86_400_000;
}

/**
 * The gate for every wedding-scoped request (API Design, "Request pipeline"):
 * a stranger or a deleted wedding is 404, so its existence never leaks; a member
 * without the permission is 403.
 */
export async function requireAccess(
  user: SessionUser,
  weddingId: string,
  permission: Permission,
  options: { allowDeleted?: boolean } = {},
): Promise<WeddingContext> {
  // Pages pass ids straight from the URL; a malformed one is simply "not found".
  if (!objectId.safeParse(weddingId).success) throw notFound();
  const [wedding, membership] = await Promise.all([
    repo.findWedding(weddingId),
    getMembership(weddingId, user.id),
  ]);
  if (!wedding || !membership) throw notFound();
  if (wedding.deletedAt && !(options.allowDeleted && withinRestoreWindow(wedding.deletedAt))) {
    throw notFound();
  }
  const ctx: WeddingContext = { user, membership, wedding };
  assertCan(ctx, permission);
  return ctx;
}

function slugTakenError(): AppError {
  return new AppError("SLUG_TAKEN", "That website address is taken", {
    fields: { slug: "That address is taken. Try another." },
  });
}

/** Wedding + owner membership + activity entry, all or nothing. */
export async function createWedding(
  user: SessionUser,
  input: CreateWeddingInput,
): Promise<MyWeddingDto> {
  if (await repo.slugTaken(input.slug)) throw slugTakenError();
  try {
    return await withTransaction(async (session) => {
      const wedding = await repo.insertWedding(input, user.id, session);
      const membership = await addOwner(wedding.id, user.id, session);
      await logActivity(
        {
          weddingId: wedding.id,
          actorId: user.id,
          actorLabel: user.name,
          action: "created",
          entity: "wedding",
          entityId: wedding.id,
          summary: `${user.name} created the wedding of ${wedding.brideName} & ${wedding.groomName}`,
        },
        session,
      );
      return { ...wedding, role: membership.role, side: membership.side };
    });
  } catch (error) {
    // Two people grabbing the same slug at once: the unique index decides.
    if (isDuplicateKeyError(error)) throw slugTakenError();
    throw error;
  }
}

export function toMyWedding(ctx: WeddingContext): MyWeddingDto {
  return { ...ctx.wedding, role: ctx.membership.role, side: ctx.membership.side };
}

export async function updateWedding(
  ctx: WeddingContext,
  input: UpdateWeddingInput,
): Promise<MyWeddingDto> {
  if (
    input.slug &&
    input.slug !== ctx.wedding.slug &&
    (await repo.slugTaken(input.slug, ctx.wedding.id))
  ) {
    throw slugTakenError();
  }
  let updated: WeddingDto | null;
  try {
    updated = await repo.updateWedding(ctx.wedding.id, input);
  } catch (error) {
    if (isDuplicateKeyError(error)) throw slugTakenError();
    throw error;
  }
  if (!updated) throw notFound();
  await logActivity({
    weddingId: ctx.wedding.id,
    actorId: ctx.user.id,
    actorLabel: ctx.user.name,
    action: "updated",
    entity: "wedding",
    entityId: ctx.wedding.id,
    summary: `${ctx.user.name} updated the wedding details`,
  });
  return { ...updated, role: ctx.membership.role, side: ctx.membership.side };
}

/** Soft delete: hidden at once, restorable for 30 days, then purged by the cron. */
export async function deleteWedding(ctx: WeddingContext, confirmSlug: string): Promise<void> {
  if (confirmSlug !== ctx.wedding.slug) {
    throw new AppError("VALIDATION_FAILED", "Type the website address to confirm", {
      fields: { slug: `Type ${ctx.wedding.slug} to confirm` },
    });
  }
  await repo.setDeletedAt(ctx.wedding.id, new Date());
  await logActivity({
    weddingId: ctx.wedding.id,
    actorId: ctx.user.id,
    actorLabel: ctx.user.name,
    action: "deleted",
    entity: "wedding",
    entityId: ctx.wedding.id,
    summary: `${ctx.user.name} deleted the wedding`,
  });
}

export async function restoreWedding(ctx: WeddingContext): Promise<MyWeddingDto> {
  if (ctx.wedding.deletedAt) {
    await repo.setDeletedAt(ctx.wedding.id, null);
    await logActivity({
      weddingId: ctx.wedding.id,
      actorId: ctx.user.id,
      actorLabel: ctx.user.name,
      action: "updated",
      entity: "wedding",
      entityId: ctx.wedding.id,
      summary: `${ctx.user.name} restored the wedding`,
    });
  }
  return { ...ctx.wedding, deletedAt: null, role: ctx.membership.role, side: ctx.membership.side };
}

/**
 * Every wedding the user belongs to (FR-1.3). Deleted weddings still inside the
 * restore window are listed for their owners only, so they can bring them back.
 */
export async function listMyWeddings(user: SessionUser): Promise<MyWeddingDto[]> {
  const memberships = await listMembershipsForUser(user.id);
  const byId = new Map(memberships.map((m) => [m.weddingId, m]));
  const weddings = await repo.findWeddings([...byId.keys()]);
  const result: MyWeddingDto[] = [];
  for (const wedding of weddings) {
    const m = byId.get(wedding.id);
    if (!m) continue;
    if (wedding.deletedAt && !(m.role === "owner" && withinRestoreWindow(wedding.deletedAt)))
      continue;
    result.push({ ...wedding, role: m.role, side: m.side });
  }
  return result;
}

export async function checkSlug(slug: string): Promise<SlugAvailabilityDto> {
  const parsed = slugField.safeParse(slug);
  if (!parsed.success) return { slug, available: false };
  return { slug: parsed.data, available: !(await repo.slugTaken(parsed.data)) };
}

export interface WeddingSummaryDto {
  daysToGo: number;
  events: number;
  tasks: TaskCountsDto;
  /** Per event; an organizer sees their own side's numbers. */
  rsvps: EventRsvpSummaryDto[];
}

/** Dashboard numbers (API Design, "summary"). Photo totals join in Phase 6. */
export async function getSummary(ctx: WeddingContext): Promise<WeddingSummaryDto> {
  const [events, tasks, rsvps] = await Promise.all([
    countWeddingEvents(ctx.wedding.id),
    countWeddingTasks(ctx.wedding.id, ctx.wedding.timezone),
    rsvpSummary(ctx),
  ]);
  return {
    daysToGo: daysUntil(ctx.wedding.primaryDate, ctx.wedding.timezone),
    events,
    tasks,
    rsvps,
  };
}

/**
 * The wedding behind a guest link (RSVP now, gallery later). A deleted wedding
 * is null, so its links stop working at once.
 */
export async function getPublicWedding(weddingId: string): Promise<WeddingDto | null> {
  const wedding = await repo.findWedding(weddingId);
  return wedding && !wedding.deletedAt ? wedding : null;
}

/** Weddings where this user is the only owner: deleting the account would orphan them. */
export async function soleOwnedWeddings(userId: string): Promise<WeddingDto[]> {
  const owned = (await listMembershipsForUser(userId)).filter((m) => m.role === "owner");
  const sole: string[] = [];
  for (const m of owned) if ((await countOwners(m.weddingId)) <= 1) sole.push(m.weddingId);
  return repo.findWeddings(sole);
}

// Invite links (public preview, then accept while signed in)

export interface InvitePreviewDto {
  brideName: string;
  groomName: string;
  primaryDate: string;
  city: string;
  role: Role;
  side: Side;
  expiresAt: string;
}

async function openInviteWithWedding(token: string) {
  const invite = await findOpenInvite(token);
  const wedding = invite ? await repo.findWedding(invite.weddingId) : null;
  // Wrong, expired, revoked or for a deleted wedding: always the same 404.
  if (!invite || !wedding || wedding.deletedAt) throw notFound("This invite link isn't valid");
  return { invite, wedding };
}

/** What the invite page shows before accepting. Never the invitee's email. */
export async function previewInvite(token: string): Promise<InvitePreviewDto> {
  const { invite, wedding } = await openInviteWithWedding(token);
  return {
    brideName: wedding.brideName,
    groomName: wedding.groomName,
    primaryDate: wedding.primaryDate,
    city: wedding.city,
    role: invite.role,
    side: invite.side,
    expiresAt: invite.expiresAt,
  };
}

export async function acceptInvite(
  user: SessionUser,
  token: string,
): Promise<{ weddingId: string }> {
  const { invite } = await openInviteWithWedding(token);
  await withTransaction((session) => acceptMemberInvite(user, invite, session));
  return { weddingId: invite.weddingId };
}
