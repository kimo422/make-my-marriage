import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as site from "@/app/api/public/site/[slug]/route";
import { POST as unlock } from "@/app/api/public/site/[slug]/unlock/route";
import * as wedding from "@/app/api/weddings/[weddingId]/route";
import * as events from "@/app/api/weddings/[weddingId]/events/route";
import { GET as inviteCard } from "@/app/api/weddings/[weddingId]/invite-card/route";
import * as website from "@/app/api/weddings/[weddingId]/website/route";
import { zonedToUtc } from "@/lib/dates";
import type { PublicSiteDto, WebsiteSettingsDto } from "@/modules/weddings";
import { APP, call, type TestUser } from "@tests/helpers/api";
import { useTestDb } from "@tests/helpers/db";
import { asEachRole, type TeamRole, weddingWithTeam } from "@tests/helpers/wedding";

let db: Awaited<ReturnType<typeof useTestDb>>;
let users: Record<TeamRole, TestUser>;
let weddingId: string;
let otherWeddingId: string;

const SLUG = "santhvana-and-balaram";
const at = (date: string, time: string) => zonedToUtc(date, time, "Asia/Kolkata").toISOString();

beforeAll(async () => {
  db = await useTestDb();
});
afterAll(async () => {
  await db.drop();
});
beforeEach(async () => {
  await db.clear();
  ({ users, weddingId, otherWeddingId } = await weddingWithTeam());
});

const w = () => ({ weddingId });

function patch(body: object, as: TestUser = users.owner) {
  return call(website.PATCH, "PATCH", "", { cookie: as.cookie, params: w(), body });
}

function publicSite(cookie?: string) {
  return call(site.GET, "GET", `/api/public/site/${SLUG}`, {
    params: { slug: SLUG },
    ...(cookie ? { cookie } : {}),
  });
}

/** Calls unlock directly so the Set-Cookie header can be read. */
async function unlockWith(password: string) {
  const res = await unlock(
    new NextRequest(`${APP}/api/public/site/${SLUG}/unlock`, {
      method: "POST",
      headers: { origin: APP, "content-type": "application/json" },
      body: JSON.stringify({ password }),
    }),
    { params: Promise.resolve({ slug: SLUG }) },
  );
  return { status: res.status, cookie: res.headers.get("set-cookie")?.split(";")[0] ?? "" };
}

async function addEvent(name: string, isPublic: boolean) {
  const res = await call(events.POST, "POST", "", {
    cookie: users.owner.cookie,
    params: w(),
    body: {
      name,
      type: "custom",
      startAt: at("2026-12-11", "19:00"),
      endAt: at("2026-12-11", "23:00"),
      venue: { name: "Taj Krishna", mapUrl: "https://maps.app.goo.gl/abc" },
      isPublic,
    },
  });
  expect(res.status).toBe(201);
}

describe("website settings", () => {
  it("lets planners change them and the whole team read them", async () => {
    expect(await asEachRole(users, (u) => patch({ story: "We met at college." }, u))).toEqual({
      owner: 200,
      manager: 200,
      organizer: 403,
      viewer: 403,
      stranger: 404,
    });
    expect(
      await asEachRole(users, (u) =>
        call(website.GET, "GET", "", { cookie: u.cookie, params: w() }),
      ),
    ).toEqual({ owner: 200, manager: 200, organizer: 200, viewer: 200, stranger: 404 });
    const res = await call(website.GET, "GET", "", { cookie: users.viewer.cookie, params: w() });
    expect(res.body.data).toMatchObject({
      published: false,
      story: "We met at college.",
      passwordProtected: false,
      url: `${APP}/site/${SLUG}`,
    });
  });

  it("never returns the password hash and records when it was published", async () => {
    const res = await patch({ published: true, password: "family-only" });
    const data = res.body.data as WebsiteSettingsDto & Record<string, unknown>;
    expect(data.passwordProtected).toBe(true);
    expect(data.publishedAt).toBeTruthy();
    expect(JSON.stringify(data)).not.toContain("scrypt");
    expect((await patch({ password: "abc" })).status).toBe(422);
  });

  it("can't touch another wedding", async () => {
    const res = await call(website.PATCH, "PATCH", "", {
      cookie: users.owner.cookie,
      params: { weddingId: otherWeddingId },
      body: { published: true },
    });
    expect(res.status).toBe(404);
  });
});

describe("the public website", () => {
  it("is not found until published, then shows public events only", async () => {
    await addEvent("Sangeet", true);
    await addEvent("Family puja", false);
    expect((await publicSite()).status).toBe(404);

    await patch({ published: true, story: "Our story." });
    const res = await publicSite();
    expect(res.status).toBe(200);
    const data = res.body.data as Extract<PublicSiteDto, { locked: false }>;
    expect(data).toMatchObject({ locked: false, brideName: "Santhvana", story: "Our story." });
    expect(data.events.map((e) => e.name)).toEqual(["Sangeet"]);

    await patch({ published: false });
    expect((await publicSite()).status).toBe(404);
  });

  it("asks for the password, and a changed password locks old visitors out", async () => {
    await patch({ published: true, password: "family-only" });
    expect((await publicSite()).body.data).toEqual({
      locked: true,
      brideName: "Santhvana",
      groomName: "Balaram",
    });
    expect((await unlockWith("wrong-one")).status).toBe(422);

    const { status, cookie } = await unlockWith("family-only");
    expect(status).toBe(204);
    expect(cookie).toMatch(/^mmm_site_[a-f\d]{24}=\d+\.[\w-]+$/);
    expect((await publicSite(cookie)).body.data).toMatchObject({ locked: false });

    await patch({ password: "a-new-password" });
    expect((await publicSite(cookie)).body.data).toMatchObject({ locked: true });

    await patch({ password: null });
    expect((await publicSite()).body.data).toMatchObject({ locked: false });
  });

  it("rejects a forged unlock cookie", async () => {
    await patch({ published: true, password: "family-only" });
    const { cookie } = await unlockWith("family-only");
    const forged = cookie.replace(/=\d+\./, `=${String(Date.now() + 10 ** 9)}.`);
    expect((await publicSite(forged)).body.data).toMatchObject({ locked: true });
  });

  it("disappears when the wedding is deleted", async () => {
    await patch({ published: true });
    await call(wedding.DELETE, "DELETE", "", {
      cookie: users.owner.cookie,
      params: w(),
      body: { slug: SLUG },
    });
    expect((await publicSite()).status).toBe(404);
  });
});

describe("invite card", () => {
  it("renders a PNG for the team only", async () => {
    const get = (u: TestUser) =>
      inviteCard(new NextRequest(`${APP}/api/x`, { headers: { cookie: u.cookie } }), {
        params: Promise.resolve(w()),
      });
    const res = await get(users.viewer);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect((await get(users.stranger)).status).toBe(404);
  });
});
