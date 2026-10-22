import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as rsvpLink from "@/app/api/public/rsvp/[token]/route";
import { GET as calendar } from "@/app/api/public/rsvp/[token]/calendar.ics/route";
import { POST as opened } from "@/app/api/public/rsvp/[token]/opened/route";
import * as wedding from "@/app/api/weddings/[weddingId]/route";
import * as events from "@/app/api/weddings/[weddingId]/events/route";
import * as event from "@/app/api/weddings/[weddingId]/events/[eventId]/route";
import { GET as eventRsvps } from "@/app/api/weddings/[weddingId]/events/[eventId]/rsvps/route";
import * as guest from "@/app/api/weddings/[weddingId]/guests/[guestId]/route";
import { POST as commitImport } from "@/app/api/weddings/[weddingId]/guests/import/route";
import { DELETE as undoImport } from "@/app/api/weddings/[weddingId]/guests/import/[importBatchId]/route";
import { POST as previewImport } from "@/app/api/weddings/[weddingId]/guests/import/preview/route";
import * as households from "@/app/api/weddings/[weddingId]/households/route";
import * as household from "@/app/api/weddings/[weddingId]/households/[householdId]/route";
import { POST as addGuest } from "@/app/api/weddings/[weddingId]/households/[householdId]/guests/route";
import { GET as invite } from "@/app/api/weddings/[weddingId]/households/[householdId]/invite/route";
import { POST as markSent } from "@/app/api/weddings/[weddingId]/households/[householdId]/message/mark-sent/route";
import { POST as regenerate } from "@/app/api/weddings/[weddingId]/households/[householdId]/rsvp-link/regenerate/route";
import { POST as setRsvp } from "@/app/api/weddings/[weddingId]/households/[householdId]/rsvps/route";
import * as templates from "@/app/api/weddings/[weddingId]/message-templates/route";
import { GET as exportCsv } from "@/app/api/weddings/[weddingId]/rsvps/export.csv/route";
import { GET as rsvpSummary } from "@/app/api/weddings/[weddingId]/rsvps/summary/route";
import { GET as summary } from "@/app/api/weddings/[weddingId]/summary/route";
import { zonedToUtc } from "@/lib/dates";
import type { EventDto } from "@/modules/events";
import type {
  EventRsvpSummaryDto,
  HouseholdDto,
  ImportPreviewDto,
  ImportResultDto,
  InviteMessageDto,
} from "@/modules/guests";
import { APP, call, type TestUser } from "@tests/helpers/api";
import { useTestDb } from "@tests/helpers/db";
import { asEachRole, type TeamRole, weddingWithTeam } from "@tests/helpers/wedding";

let db: Awaited<ReturnType<typeof useTestDb>>;
let users: Record<TeamRole, TestUser>;
let weddingId: string;
let otherWeddingId: string;
let sangeet: EventDto;
let reception: EventDto;

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
  sangeet = await addEvent("Sangeet", "2026-12-11");
  reception = await addEvent("Reception", "2026-12-13");
});

const w = () => ({ weddingId });

async function addEvent(name: string, date: string): Promise<EventDto> {
  const res = await call(events.POST, "POST", "", {
    cookie: users.owner.cookie,
    params: w(),
    body: {
      name,
      type: "custom",
      startAt: at(date, "19:00"),
      endAt: at(date, "23:00"),
      venue: { name: "Taj Krishna", address: "Banjara Hills" },
    },
  });
  expect(res.status).toBe(201);
  return res.body.data as EventDto;
}

const sharma = (side = "bride") => ({
  name: "Sharma family",
  side,
  maxHeadcount: 3,
  invitedEventIds: [sangeet.id],
  guests: [
    { name: "Ramesh Sharma", phone: "98765 43210", email: "ramesh@example.com" },
    { name: "Priya Sharma", relation: "Wife" },
  ],
});

async function addHousehold(body: object = sharma(), as = users.owner): Promise<HouseholdDto> {
  const res = await call(households.POST, "POST", "", { cookie: as.cookie, params: w(), body });
  expect(res.status).toBe(201);
  return res.body.data as HouseholdDto;
}

async function list(query = "", as = users.owner): Promise<HouseholdDto[]> {
  const res = await call(households.GET, "GET", `/api/weddings/${weddingId}/households${query}`, {
    cookie: as.cookie,
    params: w(),
  });
  expect(res.status).toBe(200);
  return res.body.data as HouseholdDto[];
}

async function linkToken(householdId: string): Promise<string> {
  const res = await call(
    invite,
    "GET",
    `/api/weddings/${weddingId}/households/${householdId}/invite`,
    {
      cookie: users.owner.cookie,
      params: { weddingId, householdId },
    },
  );
  expect(res.status).toBe(200);
  return (res.body.data as InviteMessageDto).rsvpUrl.split("/r/")[1] ?? "";
}

describe("households", () => {
  it("creates a household with guests, primary contact and normalised phone", async () => {
    const h = await addHousehold();
    expect(h.guests).toHaveLength(2);
    expect(h.guests[0]?.phone).toBe("+919876543210");
    expect(h.primaryGuestId).toBe(h.guests[0]?.id);
    expect(h.message.state).toBe("not_sent");
  });

  it("follows the role matrix for creating", async () => {
    expect(
      await asEachRole(users, (u) =>
        call(households.POST, "POST", "", { cookie: u.cookie, params: w(), body: sharma() }),
      ),
    ).toEqual({ owner: 201, manager: 201, organizer: 201, viewer: 403, stranger: 404 });
  });

  it("lets everyone on the team read, and hides contacts from viewers", async () => {
    const h = await addHousehold();
    const statuses = await asEachRole(users, (u) =>
      call(household.GET, "GET", "", {
        cookie: u.cookie,
        params: { weddingId, householdId: h.id },
      }),
    );
    expect(statuses).toEqual({
      owner: 200,
      manager: 200,
      organizer: 200,
      viewer: 200,
      stranger: 404,
    });
    const [seen] = await list("", users.viewer);
    expect(seen?.guests[0]?.name).toBe("Ramesh Sharma");
    expect(seen?.guests[0]?.phone).toBeNull();
    expect(seen?.guests[0]?.email).toBeNull();
  });

  it("keeps an organizer to their own side", async () => {
    const groom = await addHousehold({ ...sharma("groom"), name: "Reddy family" });
    await addHousehold();
    expect((await list("", users.organizer)).map((h) => h.name)).toEqual(["Sharma family"]);
    const read = await call(household.GET, "GET", "", {
      cookie: users.organizer.cookie,
      params: { weddingId, householdId: groom.id },
    });
    expect(read.status).toBe(404);
    const create = await call(households.POST, "POST", "", {
      cookie: users.organizer.cookie,
      params: w(),
      body: sharma("groom"),
    });
    expect(create.status).toBe(403);
  });

  it("rejects another wedding's ids", async () => {
    const h = await addHousehold();
    const foreign = await call(household.GET, "GET", "", {
      cookie: users.stranger.cookie,
      params: { weddingId: otherWeddingId, householdId: h.id },
    });
    expect(foreign.status).toBe(404);
    const otherEvent = await call(events.POST, "POST", "", {
      cookie: users.stranger.cookie,
      params: { weddingId: otherWeddingId },
      body: {
        name: "Mehndi",
        type: "mehendi",
        startAt: at("2026-12-10", "10:00"),
        endAt: at("2026-12-10", "14:00"),
      },
    });
    const bad = await call(households.POST, "POST", "", {
      cookie: users.owner.cookie,
      params: w(),
      body: { ...sharma(), invitedEventIds: [(otherEvent.body.data as EventDto).id] },
    });
    expect(bad.status).toBe(422);
  });

  it("filters by search, event and pending answers", async () => {
    await addHousehold();
    await addHousehold({ ...sharma(), name: "Iyer family", invitedEventIds: [reception.id] });
    expect((await list("?q=iyer")).map((h) => h.name)).toEqual(["Iyer family"]);
    expect((await list(`?eventId=${sangeet.id}`)).map((h) => h.name)).toEqual(["Sharma family"]);
    expect(await list("?rsvp=pending")).toHaveLength(2);
  });

  it("un-inviting from an event drops that answer", async () => {
    const h = await addHousehold();
    const params = { weddingId, householdId: h.id };
    await call(setRsvp, "POST", "", {
      cookie: users.owner.cookie,
      params,
      body: { eventId: sangeet.id, attending: true, headcount: 2 },
    });
    const res = await call(household.PATCH, "PATCH", "", {
      cookie: users.owner.cookie,
      params,
      body: { invitedEventIds: [reception.id] },
    });
    expect((res.body.data as HouseholdDto).rsvps).toEqual([]);
  });

  it("deletes the household with its guests and answers", async () => {
    const h = await addHousehold();
    const del = await call(household.DELETE, "DELETE", "", {
      cookie: users.organizer.cookie,
      params: { weddingId, householdId: h.id },
    });
    expect(del.status).toBe(204);
    expect(await list()).toEqual([]);
    expect(await mongoose.connection.db?.collection("guests").countDocuments()).toBe(0);
  });
});

describe("guests", () => {
  it("adds, edits and removes guests, but not the main contact", async () => {
    const h = await addHousehold();
    const params = { weddingId, householdId: h.id };
    const added = await call(addGuest, "POST", "", {
      cookie: users.organizer.cookie,
      params,
      body: { name: "Anu Sharma", isChild: true },
    });
    expect(added.status).toBe(201);
    const anuId = (added.body.data as { id: string }).id;
    const edited = await call(guest.PATCH, "PATCH", "", {
      cookie: users.organizer.cookie,
      params: { weddingId, guestId: anuId },
      body: { phone: "+1 415 555 0100" },
    });
    expect((edited.body.data as { phone: string }).phone).toBe("+14155550100");
    const primary = await call(guest.DELETE, "DELETE", "", {
      cookie: users.owner.cookie,
      params: { weddingId, guestId: h.primaryGuestId ?? "" },
    });
    expect(primary.status).toBe(422);
    const removed = await call(guest.DELETE, "DELETE", "", {
      cookie: users.owner.cookie,
      params: { weddingId, guestId: anuId },
    });
    expect(removed.status).toBe(204);
  });

  it("rejects a bad phone number", async () => {
    const res = await call(households.POST, "POST", "", {
      cookie: users.owner.cookie,
      params: w(),
      body: { ...sharma(), guests: [{ name: "X", phone: "12345" }] },
    });
    expect(res.status).toBe(422);
    expect(res.body.error?.fields?.["guests.0.phone"]).toBeTruthy();
  });
});

describe("RSVPs entered by the team", () => {
  it("enforces capacity and invitations", async () => {
    const h = await addHousehold();
    const params = { weddingId, householdId: h.id };
    const post = (body: object, as = users.owner) =>
      call(setRsvp, "POST", "", { cookie: as.cookie, params, body });
    expect(
      (await post({ eventId: sangeet.id, attending: true, headcount: 4 })).body.error?.code,
    ).toBe("RSVP_OVER_CAPACITY");
    expect(
      (await post({ eventId: reception.id, attending: true, headcount: 1 })).body.error?.code,
    ).toBe("EVENT_NOT_INVITED");
    const okRes = await post({ eventId: sangeet.id, attending: true, headcount: 3 });
    expect(okRes.status).toBe(200);
    expect(okRes.body.data).toMatchObject({ source: "organizer", headcount: 3 });
    expect(
      await asEachRole(users, (u) =>
        post({ eventId: sangeet.id, attending: false, headcount: 0 }, u),
      ),
    ).toEqual({
      owner: 200,
      manager: 200,
      organizer: 200,
      viewer: 403,
      stranger: 404,
    });
  });

  it("summarises per event, by side for organizers", async () => {
    const bride = await addHousehold();
    await addHousehold({ ...sharma("groom"), name: "Reddy family", maxHeadcount: 5 });
    await call(setRsvp, "POST", "", {
      cookie: users.owner.cookie,
      params: { weddingId, householdId: bride.id },
      body: { eventId: sangeet.id, attending: true, headcount: 2 },
    });
    const all = await call(rsvpSummary, "GET", "", { cookie: users.viewer.cookie, params: w() });
    expect(all.body.data).toEqual([
      {
        eventId: sangeet.id,
        invitedHouseholds: 2,
        invitedHeadcount: 8,
        attendingHouseholds: 1,
        declinedHouseholds: 0,
        pendingHouseholds: 1,
        attendingHeadcount: 2,
      },
    ]);
    const mine = await call(rsvpSummary, "GET", "", {
      cookie: users.organizer.cookie,
      params: w(),
    });
    expect((mine.body.data as EventRsvpSummaryDto[])[0]).toMatchObject({
      invitedHouseholds: 1,
      pendingHouseholds: 0,
    });
    const dash = await call(summary, "GET", "", { cookie: users.owner.cookie, params: w() });
    expect((dash.body.data as { rsvps: unknown[] }).rsvps).toHaveLength(1);
    const rows = await call(eventRsvps, "GET", "", {
      cookie: users.viewer.cookie,
      params: { weddingId, eventId: sangeet.id },
    });
    expect(
      (rows.body.data as { name: string; answer: unknown }[]).map((r) => [
        r.name,
        r.answer === null,
      ]),
    ).toEqual([
      ["Sharma family", false],
      ["Reddy family", true],
    ]);
  });

  it("exports the caterer CSV for planners only", async () => {
    const h = await addHousehold();
    await call(setRsvp, "POST", "", {
      cookie: users.owner.cookie,
      params: { weddingId, householdId: h.id },
      body: { eventId: sangeet.id, attending: true, headcount: 3 },
    });
    expect(
      await asEachRole(users, (u) =>
        exportCsv(new NextRequest(`${APP}/api/x`, { headers: { cookie: u.cookie } }), {
          params: Promise.resolve(w()),
        }),
      ),
    ).toEqual({ owner: 200, manager: 200, organizer: 403, viewer: 403, stranger: 404 });
    const res = await exportCsv(
      new NextRequest(`${APP}/api/x?eventId=${sangeet.id}`, {
        headers: { cookie: users.owner.cookie },
      }),
      {
        params: Promise.resolve(w()),
      },
    );
    const text = await res.text();
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(text).toContain("Sharma family,Bride,,3,3,Ramesh Sharma; Priya Sharma");
    expect(text).toContain("Total attending,,,,3,");
  });

  it("deleting an event un-invites everyone and drops its answers", async () => {
    const h = await addHousehold();
    await call(setRsvp, "POST", "", {
      cookie: users.owner.cookie,
      params: { weddingId, householdId: h.id },
      body: { eventId: sangeet.id, attending: true, headcount: 2 },
    });
    const res = await call(event.DELETE, "DELETE", "", {
      cookie: users.owner.cookie,
      params: { weddingId, eventId: sangeet.id },
    });
    expect(res.body.data).toMatchObject({ rsvpsRemoved: 1 });
    const [after] = await list();
    expect(after?.invitedEventIds).toEqual([]);
    expect(after?.rsvps).toEqual([]);
  });
});

describe("WhatsApp invites", () => {
  it("builds the message and wa.me link, and tracks sending", async () => {
    const h = await addHousehold();
    const params = { weddingId, householdId: h.id };
    const res = await call(invite, "GET", "/api/x?kind=invite", {
      cookie: users.organizer.cookie,
      params,
    });
    const msg = res.body.data as InviteMessageDto;
    expect(msg.rsvpUrl).toMatch(/\/r\/[\w-]{43}$/);
    expect(msg.messageText).toContain("Sharma family");
    expect(msg.messageText).toContain("Santhvana & Balaram");
    expect(msg.messageText).toContain(msg.rsvpUrl);
    expect(msg.whatsappUrl.startsWith("https://wa.me/919876543210?text=")).toBe(true);
    expect(
      await asEachRole(users, (u) => call(invite, "GET", "/api/x", { cookie: u.cookie, params })),
    ).toEqual({ owner: 200, manager: 200, organizer: 200, viewer: 403, stranger: 404 });

    const sent = await call(markSent, "POST", "", {
      cookie: users.organizer.cookie,
      params,
      body: { kind: "invite" },
    });
    expect((sent.body.data as HouseholdDto).message.state).toBe("sent");
    const reminded = await call(markSent, "POST", "", {
      cookie: users.owner.cookie,
      params,
      body: { kind: "reminder" },
    });
    expect((reminded.body.data as HouseholdDto).message.reminderCount).toBe(1);
    expect(await list("?messageState=sent")).toHaveLength(1);
  });

  it("uses the wedding's own templates", async () => {
    const h = await addHousehold();
    const body = {
      invite: "Hi {householdName}, RSVP: {rsvpUrl} {unknown}",
      reminder: "R",
      eventDay: "E",
    };
    const put = await call(templates.PUT, "PUT", "", {
      cookie: users.organizer.cookie,
      params: w(),
      body,
    });
    expect(put.status).toBe(200);
    expect(
      (await call(templates.PUT, "PUT", "", { cookie: users.viewer.cookie, params: w(), body }))
        .status,
    ).toBe(403);
    const res = await call(invite, "GET", "/api/x", {
      cookie: users.owner.cookie,
      params: { weddingId, householdId: h.id },
    });
    expect((res.body.data as InviteMessageDto).messageText).toMatch(
      /^Hi Sharma family, RSVP: http.+ \{unknown\}$/,
    );
  });
});

describe("the guest's RSVP link", () => {
  const p = (token: string) => ({ token });

  it("shows the invitation, records the open, and saves answers", async () => {
    const h = await addHousehold();
    const token = await linkToken(h.id);
    const view = await call(rsvpLink.GET, "GET", "", { params: p(token) });
    expect(view.status).toBe(200);
    expect(view.body.data).toMatchObject({
      householdName: "Sharma family",
      guestNames: ["Ramesh", "Priya"],
      maxHeadcount: 3,
      wedding: { brideName: "Santhvana", closed: false },
    });
    expect(JSON.stringify(view.body.data)).not.toContain("98765");
    expect((view.body.data as { events: { id: string }[] }).events.map((e) => e.id)).toEqual([
      sangeet.id,
    ]);

    expect((await call(opened, "POST", "", { params: p(token) })).status).toBe(204);
    expect((await list())[0]?.message.state).toBe("opened");

    const over = await call(rsvpLink.POST, "POST", "", {
      params: p(token),
      body: { answers: [{ eventId: sangeet.id, attending: true, headcount: 5 }] },
    });
    expect(over.body.error?.code).toBe("RSVP_OVER_CAPACITY");
    const notInvited = await call(rsvpLink.POST, "POST", "", {
      params: p(token),
      body: { answers: [{ eventId: reception.id, attending: true, headcount: 1 }] },
    });
    expect(notInvited.body.error?.code).toBe("EVENT_NOT_INVITED");
    const saved = await call(rsvpLink.POST, "POST", "", {
      params: p(token),
      body: { answers: [{ eventId: sangeet.id, attending: true, headcount: 2 }] },
    });
    expect(saved.status).toBe(200);
    const [after] = await list();
    expect(after?.message.state).toBe("responded");
    expect(after?.rsvps[0]).toMatchObject({ source: "guest", headcount: 2 });

    const ics = await calendar(new NextRequest(`${APP}/api/x`), {
      params: Promise.resolve(p(token)),
    });
    const text = await ics.text();
    expect(text).toContain("BEGIN:VEVENT");
    expect(text).toContain("SUMMARY:Sangeet: Santhvana & Balaram");
  });

  it("closes after the deadline", async () => {
    const h = await addHousehold();
    const token = await linkToken(h.id);
    await call(wedding.PATCH, "PATCH", "", {
      cookie: users.owner.cookie,
      params: w(),
      body: { rsvpDeadline: "2026-01-01" },
    });
    const res = await call(rsvpLink.POST, "POST", "", {
      params: p(token),
      body: { answers: [{ eventId: sangeet.id, attending: false, headcount: 0 }] },
    });
    expect(res.body.error?.code).toBe("RSVP_CLOSED");
    // The team can still enter answers after the deadline.
    const team = await call(setRsvp, "POST", "", {
      cookie: users.owner.cookie,
      params: { weddingId, householdId: h.id },
      body: { eventId: sangeet.id, attending: false, headcount: 0 },
    });
    expect(team.status).toBe(200);
  });

  it("stops working when regenerated, and for unknown tokens", async () => {
    const h = await addHousehold();
    const old = await linkToken(h.id);
    const res = await call(regenerate, "POST", "", {
      cookie: users.organizer.cookie,
      params: { weddingId, householdId: h.id },
    });
    const fresh = (res.body.data as { rsvpUrl: string }).rsvpUrl.split("/r/")[1] ?? "";
    expect(fresh).not.toBe(old);
    expect((await call(rsvpLink.GET, "GET", "", { params: p(old) })).status).toBe(404);
    expect((await call(rsvpLink.GET, "GET", "", { params: p(fresh) })).status).toBe(200);
    expect((await call(rsvpLink.GET, "GET", "", { params: p("x".repeat(43)) })).status).toBe(404);
  });
});

describe("CSV import", () => {
  const csv = [
    "Family,Name,Mobile,Side,Relation,Seats,Child",
    "Sharma family,Ramesh Sharma,98765 43210,Bride,Uncle,4,",
    "Sharma family,Anu Sharma,,bride,,,yes",
    "Reddy family,Suresh Reddy,98765 43210,groom,,,",
    ",Lone Guest,,b,,,",
    "Bad row,,12345,purple,,99,",
  ].join("\n");

  async function preview(text: string, as = users.owner) {
    const form = new FormData();
    form.set("file", new File([text], "guests.csv", { type: "text/csv" }));
    const res = await previewImport(
      new NextRequest(`${APP}/api/x`, {
        method: "POST",
        headers: { origin: APP, cookie: as.cookie },
        body: form,
      }),
      { params: Promise.resolve(w()) },
    );
    return { status: res.status, body: (await res.json()) as { data: ImportPreviewDto } };
  }

  it("previews rows, errors and duplicates without saving", async () => {
    const { status, body } = await preview(csv);
    expect(status).toBe(200);
    expect(body.data.rows).toHaveLength(4);
    expect(body.data.households).toBe(3);
    expect(body.data.errors).toEqual([
      { line: 6, message: expect.stringContaining("Name is missing") as string },
    ]);
    expect(body.data.duplicates).toEqual([{ line: 4, phone: "+919876543210", existing: "line 2" }]);
    expect(await list()).toEqual([]);
  });

  it("commits households and can be undone", async () => {
    const { body } = await preview(csv);
    const res = await call(commitImport, "POST", "", {
      cookie: users.owner.cookie,
      params: w(),
      body: { rows: body.data.rows, eventIds: [sangeet.id] },
    });
    expect(res.status).toBe(201);
    const result = res.body.data as ImportResultDto;
    expect(result).toMatchObject({ households: 3, guests: 4 });
    const imported = await list();
    const sharmaHousehold = imported.find((h) => h.name === "Sharma family");
    expect(sharmaHousehold).toMatchObject({ maxHeadcount: 4, invitedEventIds: [sangeet.id] });
    expect(imported.find((h) => h.name === "Lone Guest")?.maxHeadcount).toBe(1);

    const undo = await call(undoImport, "DELETE", "", {
      cookie: users.owner.cookie,
      params: { weddingId, importBatchId: result.importBatchId },
    });
    expect(undo.body.data).toEqual({ households: 3 });
    expect(await list()).toEqual([]);
  });

  it("keeps organizers to their side and defaults to it", async () => {
    const { body } = await preview("Name,Phone\nMeena,9000000001\n", users.organizer);
    expect(body.data.rows[0]?.side).toBe("bride");
    const other = await preview("Name,Side\nRaju,groom\n", users.organizer);
    expect(other.body.data.errors[0]?.message).toContain("own side");
    expect((await preview(csv, users.viewer)).status).toBe(403);
  });
});
