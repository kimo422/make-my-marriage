import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { POST as acceptInvite } from "@/app/api/invites/accept/route";
import { GET as previewInvite } from "@/app/api/invites/[token]/route";
import { DELETE as deleteMe, GET as getMe } from "@/app/api/me/route";
import * as weddings from "@/app/api/weddings/route";
import * as wedding from "@/app/api/weddings/[weddingId]/route";
import { GET as activity } from "@/app/api/weddings/[weddingId]/activity/route";
import * as invites from "@/app/api/weddings/[weddingId]/invites/route";
import { DELETE as revokeInvite } from "@/app/api/weddings/[weddingId]/invites/[inviteId]/route";
import { GET as members } from "@/app/api/weddings/[weddingId]/members/route";
import * as member from "@/app/api/weddings/[weddingId]/members/[userId]/route";
import { POST as restore } from "@/app/api/weddings/[weddingId]/restore/route";
import { GET as slugCheck } from "@/app/api/weddings/slug-availability/route";
import { call, signUpUser, type TestUser } from "@tests/helpers/api";
import { useTestDb } from "@tests/helpers/db";

let db: Awaited<ReturnType<typeof useTestDb>>;

type Role = "owner" | "manager" | "organizer" | "viewer" | "stranger";
let users: Record<Role, TestUser>;
let weddingA: string;
let weddingB: string;

const newWedding = (slug: string) => ({
  brideName: "Santhvana",
  groomName: "Balaram",
  primaryDate: "2026-12-12",
  city: "Hyderabad",
  tradition: "Telugu",
  slug,
});

async function inviteAndJoin(
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

beforeAll(async () => {
  db = await useTestDb();
});
afterAll(async () => {
  await db.drop();
});

beforeEach(async () => {
  await db.clear();
  users = {
    owner: await signUpUser("Santhvana", "owner@example.com"),
    manager: await signUpUser("Amma", "manager@example.com"),
    organizer: await signUpUser("Cousin Ravi", "organizer@example.com"),
    viewer: await signUpUser("Uncle", "viewer@example.com"),
    stranger: await signUpUser("Stranger", "stranger@example.com"),
  };
  const a = await call(weddings.POST, "POST", "/api/weddings", {
    cookie: users.owner.cookie,
    body: newWedding("santhvana-and-balaram"),
  });
  expect(a.status).toBe(201);
  weddingA = (a.body.data as { id: string }).id;
  const b = await call(weddings.POST, "POST", "/api/weddings", {
    cookie: users.stranger.cookie,
    body: newWedding("someone-else"),
  });
  weddingB = (b.body.data as { id: string }).id;

  await inviteAndJoin(weddingA, users.owner, users.manager, "manager");
  await inviteAndJoin(weddingA, users.owner, users.organizer, "organizer", "bride");
  await inviteAndJoin(weddingA, users.owner, users.viewer, "viewer");
});

const ROLES: Role[] = ["owner", "manager", "organizer", "viewer", "stranger"];

/** Expected status per role; strangers always get 404 so a wedding's existence never leaks. */
function expectMatrix(results: Record<Role, number>, expected: Record<Role, number>) {
  expect(results).toEqual(expected);
}

async function asEach(run: (user: TestUser) => Promise<{ status: number }>) {
  const out = {} as Record<Role, number>;
  for (const role of ROLES) out[role] = (await run(users[role])).status;
  return out;
}

describe("creating a wedding", () => {
  it("makes the creator its owner", async () => {
    const res = await call(wedding.GET, "GET", `/api/weddings/${weddingA}`, {
      cookie: users.owner.cookie,
      params: { weddingId: weddingA },
    });
    expect(res.body.data).toMatchObject({
      brideName: "Santhvana",
      groomName: "Balaram",
      primaryDate: "2026-12-12",
      slug: "santhvana-and-balaram",
      timezone: "Asia/Kolkata",
      role: "owner",
      side: "both",
    });
  });

  it("refuses a taken slug with SLUG_TAKEN and a field message", async () => {
    const res = await call(weddings.POST, "POST", "/api/weddings", {
      cookie: users.viewer.cookie,
      body: newWedding("santhvana-and-balaram"),
    });
    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe("SLUG_TAKEN");
    expect(res.body.error?.fields?.slug).toBeDefined();
  });

  it("validates input and needs a session", async () => {
    const bad = await call(weddings.POST, "POST", "/api/weddings", {
      cookie: users.owner.cookie,
      body: { ...newWedding("Bad Slug!"), primaryDate: "2026-02-30" },
    });
    expect(bad.status).toBe(422);
    expect(Object.keys(bad.body.error?.fields ?? {})).toEqual(
      expect.arrayContaining(["slug", "primaryDate"]),
    );
    const anon = await call(weddings.POST, "POST", "/api/weddings", {
      body: newWedding("anon-slug"),
    });
    expect(anon.status).toBe(401);
  });

  it("reports slug availability", async () => {
    const taken = await call(
      slugCheck,
      "GET",
      "/api/weddings/slug-availability?slug=santhvana-and-balaram",
      {
        cookie: users.owner.cookie,
      },
    );
    const free = await call(slugCheck, "GET", "/api/weddings/slug-availability?slug=a-free-one", {
      cookie: users.owner.cookie,
    });
    expect(taken.body.data).toEqual({ slug: "santhvana-and-balaram", available: false });
    expect(free.body.data).toEqual({ slug: "a-free-one", available: true });
  });
});

describe("role matrix", () => {
  it("GET wedding: every member; strangers 404", async () => {
    expectMatrix(
      await asEach((u) =>
        call(wedding.GET, "GET", `/api/weddings/${weddingA}`, {
          cookie: u.cookie,
          params: { weddingId: weddingA },
        }),
      ),
      { owner: 200, manager: 200, organizer: 200, viewer: 200, stranger: 404 },
    );
  });

  it("PATCH wedding: owner and manager only", async () => {
    expectMatrix(
      await asEach((u) =>
        call(wedding.PATCH, "PATCH", `/api/weddings/${weddingA}`, {
          cookie: u.cookie,
          params: { weddingId: weddingA },
          body: { city: "Vijayawada" },
        }),
      ),
      { owner: 200, manager: 200, organizer: 403, viewer: 403, stranger: 404 },
    );
  });

  it("GET members and activity: every member", async () => {
    const path = `/api/weddings/${weddingA}`;
    expectMatrix(
      await asEach((u) =>
        call(members, "GET", `${path}/members`, {
          cookie: u.cookie,
          params: { weddingId: weddingA },
        }),
      ),
      { owner: 200, manager: 200, organizer: 200, viewer: 200, stranger: 404 },
    );
    expectMatrix(
      await asEach((u) =>
        call(activity, "GET", `${path}/activity`, {
          cookie: u.cookie,
          params: { weddingId: weddingA },
        }),
      ),
      { owner: 200, manager: 200, organizer: 200, viewer: 200, stranger: 404 },
    );
  });

  it("invites: owner and manager list and create them", async () => {
    const path = `/api/weddings/${weddingA}/invites`;
    expectMatrix(
      await asEach((u) =>
        call(invites.GET, "GET", path, { cookie: u.cookie, params: { weddingId: weddingA } }),
      ),
      { owner: 200, manager: 200, organizer: 403, viewer: 403, stranger: 404 },
    );
    expectMatrix(
      await asEach((u) =>
        call(invites.POST, "POST", path, {
          cookie: u.cookie,
          params: { weddingId: weddingA },
          body: { email: `new-${u.id}@example.com`, role: "organizer", side: "groom" },
        }),
      ),
      { owner: 201, manager: 201, organizer: 403, viewer: 403, stranger: 404 },
    );
  });

  it("only owners can invite an owner", async () => {
    const path = `/api/weddings/${weddingA}/invites`;
    const body = { email: "co-owner@example.com", role: "owner", side: "both" };
    const asManager = await call(invites.POST, "POST", path, {
      cookie: users.manager.cookie,
      params: { weddingId: weddingA },
      body,
    });
    const asOwner = await call(invites.POST, "POST", path, {
      cookie: users.owner.cookie,
      params: { weddingId: weddingA },
      body,
    });
    expect([asManager.status, asOwner.status]).toEqual([403, 201]);
  });

  it("PATCH member: owner and manager can change an organizer's side", async () => {
    const target = users.organizer.id;
    const results = {} as Record<Role, number>;
    for (const role of ROLES) {
      results[role] = (
        await call(member.PATCH, "PATCH", `/api/weddings/${weddingA}/members/${target}`, {
          cookie: users[role].cookie,
          params: { weddingId: weddingA, userId: target },
          body: { side: role === "owner" ? "groom" : "bride" },
        })
      ).status;
    }
    expect(results).toEqual({
      owner: 200,
      manager: 200,
      organizer: 403,
      viewer: 403,
      stranger: 404,
    });
  });

  it("managers can't promote anyone to owner or touch an owner", async () => {
    const p = (userId: string, body: unknown) =>
      call(member.PATCH, "PATCH", `/api/weddings/${weddingA}/members/${userId}`, {
        cookie: users.manager.cookie,
        params: { weddingId: weddingA, userId },
        body,
      });
    expect((await p(users.viewer.id, { role: "owner" })).status).toBe(403);
    expect((await p(users.owner.id, { role: "viewer" })).status).toBe(403);
    expect((await p(users.viewer.id, { role: "organizer" })).status).toBe(200);
  });
});

describe("owner rules", () => {
  it("won't demote or remove the last owner", async () => {
    const demote = await call(
      member.PATCH,
      "PATCH",
      `/api/weddings/${weddingA}/members/${users.owner.id}`,
      {
        cookie: users.owner.cookie,
        params: { weddingId: weddingA, userId: users.owner.id },
        body: { role: "manager" },
      },
    );
    expect([demote.status, demote.body.error?.code]).toEqual([409, "LAST_OWNER"]);

    const leave = await call(
      member.DELETE,
      "DELETE",
      `/api/weddings/${weddingA}/members/${users.owner.id}`,
      {
        cookie: users.owner.cookie,
        params: { weddingId: weddingA, userId: users.owner.id },
      },
    );
    expect([leave.status, leave.body.error?.code]).toEqual([409, "LAST_OWNER"]);
  });

  it("allows it once there's a second owner (two-step ownership transfer)", async () => {
    const promote = await call(
      member.PATCH,
      "PATCH",
      `/api/weddings/${weddingA}/members/${users.manager.id}`,
      {
        cookie: users.owner.cookie,
        params: { weddingId: weddingA, userId: users.manager.id },
        body: { role: "owner" },
      },
    );
    expect(promote.status).toBe(200);
    const leave = await call(
      member.DELETE,
      "DELETE",
      `/api/weddings/${weddingA}/members/${users.owner.id}`,
      {
        cookie: users.owner.cookie,
        params: { weddingId: weddingA, userId: users.owner.id },
      },
    );
    expect(leave.status).toBe(204);
  });
});

describe("removing and leaving", () => {
  it("anyone can leave; only owner/manager can remove others", async () => {
    const del = (actor: TestUser, target: TestUser) =>
      call(member.DELETE, "DELETE", `/api/weddings/${weddingA}/members/${target.id}`, {
        cookie: actor.cookie,
        params: { weddingId: weddingA, userId: target.id },
      });
    expect((await del(users.organizer, users.viewer)).status).toBe(403);
    expect((await del(users.viewer, users.viewer)).status).toBe(204);
    expect((await del(users.manager, users.organizer)).status).toBe(204);
    expect((await del(users.manager, users.owner)).status).toBe(403);
  });
});

describe("tenant isolation", () => {
  it("never lets one wedding's member reach another wedding", async () => {
    // Owner of A using wedding B's id, on every kind of route.
    const asOwnerA = { cookie: users.owner.cookie, params: { weddingId: weddingB } };
    expect((await call(wedding.GET, "GET", `/api/weddings/${weddingB}`, asOwnerA)).status).toBe(
      404,
    );
    expect((await call(members, "GET", `/api/weddings/${weddingB}/members`, asOwnerA)).status).toBe(
      404,
    );
    expect(
      (await call(invites.GET, "GET", `/api/weddings/${weddingB}/invites`, asOwnerA)).status,
    ).toBe(404);
    expect(
      (
        await call(
          member.PATCH,
          "PATCH",
          `/api/weddings/${weddingB}/members/${users.stranger.id}`,
          {
            cookie: users.owner.cookie,
            params: { weddingId: weddingB, userId: users.stranger.id },
            body: { role: "viewer" },
          },
        )
      ).status,
    ).toBe(404);
    // A member of A who isn't in B: B's member id inside A's path is just "not found".
    const crossed = await call(
      member.PATCH,
      "PATCH",
      `/api/weddings/${weddingA}/members/${users.stranger.id}`,
      {
        cookie: users.owner.cookie,
        params: { weddingId: weddingA, userId: users.stranger.id },
        body: { side: "bride" },
      },
    );
    expect(crossed.status).toBe(404);
  });

  it("treats malformed ids as not found", async () => {
    const res = await call(wedding.GET, "GET", "/api/weddings/not-an-id", {
      cookie: users.owner.cookie,
      params: { weddingId: "not-an-id" },
    });
    expect(res.status).toBe(404);
  });
});

describe("invite links", () => {
  async function createInvite(email: string, role = "organizer") {
    const res = await call(invites.POST, "POST", `/api/weddings/${weddingA}/invites`, {
      cookie: users.owner.cookie,
      params: { weddingId: weddingA },
      body: { email, role, side: "groom" },
    });
    const data = res.body.data as { invite: { id: string }; inviteUrl: string };
    return { id: data.invite.id, token: new URL(data.inviteUrl).pathname.split("/").pop() ?? "" };
  }

  it("previews without revealing the email", async () => {
    const { token } = await createInvite("cousin@example.com");
    const res = await call(previewInvite, "GET", `/api/invites/${token}`, { params: { token } });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      brideName: "Santhvana",
      groomName: "Balaram",
      role: "organizer",
      side: "groom",
    });
    expect(JSON.stringify(res.body)).not.toContain("cousin@example.com");
  });

  it("only works for the invited email, once", async () => {
    const cousin = await signUpUser("Cousin", "cousin@example.com");
    const { token } = await createInvite("cousin@example.com");

    const wrongPerson = await call(acceptInvite, "POST", "/api/invites/accept", {
      cookie: users.stranger.cookie,
      body: { token },
    });
    expect(wrongPerson.status).toBe(403);

    const ok = await call(acceptInvite, "POST", "/api/invites/accept", {
      cookie: cousin.cookie,
      body: { token },
    });
    expect(ok.body.data).toEqual({ weddingId: weddingA });

    const again = await call(acceptInvite, "POST", "/api/invites/accept", {
      cookie: cousin.cookie,
      body: { token },
    });
    expect(again.status).toBe(404);
  });

  it("stops working when revoked or replaced", async () => {
    const first = await createInvite("aunt@example.com");
    const second = await createInvite("aunt@example.com");
    expect((await call(previewInvite, "GET", "", { params: { token: first.token } })).status).toBe(
      404,
    );

    const revoked = await call(revokeInvite, "DELETE", "", {
      cookie: users.manager.cookie,
      params: { weddingId: weddingA, inviteId: second.id },
    });
    expect(revoked.status).toBe(204);
    expect((await call(previewInvite, "GET", "", { params: { token: second.token } })).status).toBe(
      404,
    );
  });

  it("refuses to invite an existing member", async () => {
    const res = await call(invites.POST, "POST", `/api/weddings/${weddingA}/invites`, {
      cookie: users.owner.cookie,
      params: { weddingId: weddingA },
      body: { email: users.viewer.email, role: "manager", side: "both" },
    });
    expect([res.status, res.body.error?.code]).toEqual([409, "CONFLICT"]);
  });

  it("rejects made-up tokens with the same 404", async () => {
    const token = "x".repeat(43);
    expect((await call(previewInvite, "GET", "", { params: { token } })).status).toBe(404);
  });
});

describe("delete and restore", () => {
  it("needs the owner and the slug typed back", async () => {
    const path = `/api/weddings/${weddingA}`;
    const asManager = await call(wedding.DELETE, "DELETE", path, {
      cookie: users.manager.cookie,
      params: { weddingId: weddingA },
      body: { slug: "santhvana-and-balaram" },
    });
    expect(asManager.status).toBe(403);
    const wrongSlug = await call(wedding.DELETE, "DELETE", path, {
      cookie: users.owner.cookie,
      params: { weddingId: weddingA },
      body: { slug: "nope" },
    });
    expect(wrongSlug.status).toBe(422);
    const ok = await call(wedding.DELETE, "DELETE", path, {
      cookie: users.owner.cookie,
      params: { weddingId: weddingA },
      body: { slug: "santhvana-and-balaram" },
    });
    expect(ok.status).toBe(204);
  });

  it("hides a deleted wedding from everyone but lets its owner restore it", async () => {
    await call(wedding.DELETE, "DELETE", `/api/weddings/${weddingA}`, {
      cookie: users.owner.cookie,
      params: { weddingId: weddingA },
      body: { slug: "santhvana-and-balaram" },
    });
    expectMatrix(
      await asEach((u) =>
        call(wedding.GET, "GET", `/api/weddings/${weddingA}`, {
          cookie: u.cookie,
          params: { weddingId: weddingA },
        }),
      ),
      { owner: 404, manager: 404, organizer: 404, viewer: 404, stranger: 404 },
    );

    const ownerMe = await call(getMe, "GET", "/api/me", { cookie: users.owner.cookie });
    const listed = (ownerMe.body.data as { weddings: { id: string; deletedAt: string | null }[] })
      .weddings;
    expect(listed.find((w) => w.id === weddingA)?.deletedAt).toBeTruthy();
    const managerMe = await call(getMe, "GET", "/api/me", { cookie: users.manager.cookie });
    expect((managerMe.body.data as { weddings: unknown[] }).weddings).toEqual([]);

    const byManager = await call(restore, "POST", "", {
      cookie: users.manager.cookie,
      params: { weddingId: weddingA },
    });
    expect(byManager.status).toBe(403);
    const byOwner = await call(restore, "POST", "", {
      cookie: users.owner.cookie,
      params: { weddingId: weddingA },
    });
    expect(byOwner.status).toBe(200);
    const back = await call(wedding.GET, "GET", "", {
      cookie: users.viewer.cookie,
      params: { weddingId: weddingA },
    });
    expect(back.status).toBe(200);
  });
});

describe("/api/me", () => {
  it("lists the user's weddings with their role and side", async () => {
    const res = await call(getMe, "GET", "/api/me", { cookie: users.organizer.cookie });
    const data = res.body.data as { weddings: { id: string; role: string; side: string }[] };
    expect(data.weddings).toEqual([
      expect.objectContaining({ id: weddingA, role: "organizer", side: "bride" }),
    ]);
  });

  it("refuses to delete a sole owner's account, then deletes others", async () => {
    const sole = await call(deleteMe, "DELETE", "/api/me", {
      cookie: users.owner.cookie,
      body: { password: "a-strong-password" },
    });
    expect([sole.status, sole.body.error?.code]).toEqual([409, "SOLE_OWNER"]);

    const wrongPassword = await call(deleteMe, "DELETE", "/api/me", {
      cookie: users.viewer.cookie,
      body: { password: "not-my-password" },
    });
    expect(wrongPassword.status).toBe(422);

    const gone = await call(deleteMe, "DELETE", "/api/me", {
      cookie: users.viewer.cookie,
      body: { password: "a-strong-password" },
    });
    expect(gone.status).toBe(204);
    const list = await call(members, "GET", "", {
      cookie: users.owner.cookie,
      params: { weddingId: weddingA },
    });
    expect((list.body.data as { userId: string }[]).map((m) => m.userId)).not.toContain(
      users.viewer.id,
    );
  });
});
