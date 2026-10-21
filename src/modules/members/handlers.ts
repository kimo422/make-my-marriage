import "server-only";

import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { notFound } from "@/lib/errors";
import { created, list, noContent, ok, parseJson, parseParams, route } from "@/lib/http";
import { objectId } from "@/lib/validation/common";
import { acceptInvite, previewInvite, requireAccess } from "@/modules/weddings";

import { acceptInviteSchema, createInviteSchema, updateMemberSchema } from "./schema";
import {
  changeMember,
  createInvite,
  listInvites,
  listMembers,
  removeMember,
  revokeInvite,
} from "./service";

const weddingParams = z.object({ weddingId: objectId });
const memberParams = z.object({ weddingId: objectId, userId: objectId });
const inviteParams = z.object({ weddingId: objectId, inviteId: objectId });

/** GET /api/weddings/:weddingId/members (min role: viewer). */
export const listMembersHandler = route<{ weddingId: string }>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  await requireAccess(user, weddingId, "members.view");
  return list(await listMembers(weddingId));
});

/** PATCH /api/weddings/:weddingId/members/:userId: role or side (manager; owner to touch owners). */
export const patchMemberHandler = route<{ weddingId: string; userId: string }>(
  async (request, { params }) => {
    const user = await requireUser(request);
    const { weddingId, userId } = parseParams(params, memberParams);
    const ctx = await requireAccess(user, weddingId, "members.manage");
    return ok(await changeMember(ctx, userId, await parseJson(request, updateMemberSchema)));
  },
);

/** DELETE /api/weddings/:weddingId/members/:userId: remove (manager) or leave (anyone). */
export const deleteMemberHandler = route<{ weddingId: string; userId: string }>(
  async (request, { params }) => {
    const user = await requireUser(request);
    const { weddingId, userId } = parseParams(params, memberParams);
    // members.view lets anyone reach the service, which allows leaving and
    // checks members.manage before removing someone else.
    const ctx = await requireAccess(user, weddingId, "members.view");
    await removeMember(ctx, userId);
    return noContent();
  },
);

/** GET /api/weddings/:weddingId/invites: pending invites (manager). */
export const listInvitesHandler = route<{ weddingId: string }>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  await requireAccess(user, weddingId, "members.manage");
  return list(await listInvites(weddingId));
});

/** POST /api/weddings/:weddingId/invites: returns the one-time link to share (manager). */
export const createInviteHandler = route<{ weddingId: string }>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  const ctx = await requireAccess(user, weddingId, "members.manage");
  return created(await createInvite(ctx, await parseJson(request, createInviteSchema)));
});

/** DELETE /api/weddings/:weddingId/invites/:inviteId: revoke a pending invite (manager). */
export const revokeInviteHandler = route<{ weddingId: string; inviteId: string }>(
  async (request, { params }) => {
    const user = await requireUser(request);
    const { weddingId, inviteId } = parseParams(params, inviteParams);
    const ctx = await requireAccess(user, weddingId, "members.manage");
    await revokeInvite(ctx, inviteId);
    return noContent();
  },
);

/** GET /api/invites/:token: public preview (names, role, side; never the email). */
export const previewInviteHandler = route<{ token: string }>(async (_request, { params }) => {
  const token = params.token;
  if (token.length < 20 || token.length > 200) throw notFound("This invite link isn't valid");
  return ok(await previewInvite(token));
});

/** POST /api/invites/accept: { token }, signed in as the invited address. */
export const acceptInviteHandler = route(async (request) => {
  const user = await requireUser(request);
  const { token } = await parseJson(request, acceptInviteSchema);
  return ok(await acceptInvite(user, token));
});
