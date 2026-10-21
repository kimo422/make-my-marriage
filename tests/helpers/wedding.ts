import { expect } from "vitest";

import { POST as acceptInvite } from "@/app/api/invites/accept/route";
import * as weddings from "@/app/api/weddings/route";
import * as invites from "@/app/api/weddings/[weddingId]/invites/route";
import { call, signUpUser, type TestUser } from "@tests/helpers/api";

export type TeamRole = "owner" | "manager" | "organizer" | "viewer" | "stranger";
export const TEAM_ROLES: TeamRole[] = ["owner", "manager", "organizer", "viewer", "stranger"];

export const sampleWedding = (slug: string) => ({
  brideName: "Santhvana",
  groomName: "Balaram",
  primaryDate: "2026-12-12",
  city: "Hyderabad",
  tradition: "Telugu",
  slug,
});

export async function createWedding(owner: TestUser, slug: string): Promise<string> {
  const res = await call(weddings.POST, "POST", "/api/weddings", {
    cookie: owner.cookie,
    body: sampleWedding(slug),
  });
  expect(res.status).toBe(201);
  return (res.body.data as { id: string }).id;
}

/** Invites `invitee` with a role and has them accept, through the real API. */
export async function inviteAndJoin(
  weddingId: string,
  inviter: TestUser,
  invitee: TestUser,
  role: string,
  side = "both",
) {
  const created = await call(invites.POST, "POST", `/api/weddings/${weddingId}/invites`, {
    cookie: inviter.cookie,
    params: { weddingId },
    body: { email: invitee.email, role, side },
  });
  expect(created.status).toBe(201);
  const token = new URL((created.body.data as { inviteUrl: string }).inviteUrl).pathname
    .split("/")
    .pop();
  const joined = await call(acceptInvite, "POST", "/api/invites/accept", {
    cookie: invitee.cookie,
    body: { token },
  });
  expect(joined.status).toBe(200);
}

/**
 * A wedding with one member per role, plus a stranger who owns a different
 * wedding: the standard fixture for role-matrix and tenant-isolation tests.
 */
export async function weddingWithTeam() {
  const users: Record<TeamRole, TestUser> = {
    owner: await signUpUser("Santhvana", "owner@example.com"),
    manager: await signUpUser("Amma", "manager@example.com"),
    organizer: await signUpUser("Cousin Ravi", "organizer@example.com"),
    viewer: await signUpUser("Uncle", "viewer@example.com"),
    stranger: await signUpUser("Stranger", "stranger@example.com"),
  };
  const weddingId = await createWedding(users.owner, "santhvana-and-balaram");
  const otherWeddingId = await createWedding(users.stranger, "someone-else");
  await inviteAndJoin(weddingId, users.owner, users.manager, "manager");
  await inviteAndJoin(weddingId, users.owner, users.organizer, "organizer", "bride");
  await inviteAndJoin(weddingId, users.owner, users.viewer, "viewer");
  return { users, weddingId, otherWeddingId };
}

/** Runs one request as each role and returns the status codes. */
export async function asEachRole(
  users: Record<TeamRole, TestUser>,
  run: (user: TestUser, role: TeamRole) => Promise<{ status: number }>,
): Promise<Record<TeamRole, number>> {
  const out = {} as Record<TeamRole, number>;
  for (const role of TEAM_ROLES) out[role] = (await run(users[role], role)).status;
  return out;
}
