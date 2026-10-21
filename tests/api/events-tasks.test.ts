import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { GET as checklists } from "@/app/api/weddings/[weddingId]/checklists/route";
import * as events from "@/app/api/weddings/[weddingId]/events/route";
import * as event from "@/app/api/weddings/[weddingId]/events/[eventId]/route";
import { GET as impact } from "@/app/api/weddings/[weddingId]/events/[eventId]/impact/route";
import { POST as reorder } from "@/app/api/weddings/[weddingId]/events/reorder/route";
import { GET as summary } from "@/app/api/weddings/[weddingId]/summary/route";
import * as tasks from "@/app/api/weddings/[weddingId]/tasks/route";
import * as task from "@/app/api/weddings/[weddingId]/tasks/[taskId]/route";
import { POST as importChecklist } from "@/app/api/weddings/[weddingId]/tasks/import-checklist/route";
import { POST as move } from "@/app/api/weddings/[weddingId]/tasks/[taskId]/move/route";
import { zonedToUtc } from "@/lib/dates";
import type { EventDto } from "@/modules/events";
import type { TaskDto } from "@/modules/tasks";
import { APP, call, type TestUser } from "@tests/helpers/api";
import { useTestDb } from "@tests/helpers/db";
import { asEachRole, type TeamRole, weddingWithTeam } from "@tests/helpers/wedding";

let db: Awaited<ReturnType<typeof useTestDb>>;
let users: Record<TeamRole, TestUser>;
let weddingId: string;
let otherWeddingId: string;

const IST = "Asia/Kolkata";
const at = (date: string, time: string) => zonedToUtc(date, time, IST).toISOString();
const sangeet = {
  name: "Sangeet",
  type: "sangeet",
  startAt: at("2026-12-11", "19:00"),
  endAt: at("2026-12-11", "23:30"),
  venue: {
    name: "Taj Krishna",
    address: "Banjara Hills, Hyderabad",
    mapUrl: "https://maps.app.goo.gl/abc",
  },
  dressCode: "Indo-western",
};

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

async function addEvent(body: object, as: TestUser = users.owner): Promise<EventDto> {
  const res = await call(events.POST, "POST", "", { cookie: as.cookie, params: w(), body });
  expect(res.status).toBe(201);
  return res.body.data as EventDto;
}

async function addTask(body: object, as: TestUser = users.owner): Promise<TaskDto> {
  const res = await call(tasks.POST, "POST", "", { cookie: as.cookie, params: w(), body });
  expect(res.status).toBe(201);
  return res.body.data as TaskDto;
}

async function listTasks(query = "", as: TestUser = users.owner): Promise<TaskDto[]> {
  const res = await call(tasks.GET, "GET", `/api/weddings/${weddingId}/tasks${query}`, {
    cookie: as.cookie,
    params: w(),
  });
  return res.body.data as TaskDto[];
}

describe("events", () => {
  it("lets owners and managers create, and everyone read", async () => {
    expect(
      await asEachRole(users, (u, role) =>
        call(events.POST, "POST", "", {
          cookie: u.cookie,
          params: w(),
          body: { ...sangeet, name: `Sangeet ${role}` },
        }),
      ),
    ).toEqual({ owner: 201, manager: 201, organizer: 403, viewer: 403, stranger: 404 });

    expect(
      await asEachRole(users, (u) =>
        call(events.GET, "GET", "", { cookie: u.cookie, params: w() }),
      ),
    ).toEqual({ owner: 200, manager: 200, organizer: 200, viewer: 200, stranger: 404 });
  });

  it("stores times in UTC and the venue as given", async () => {
    const e = await addEvent(sangeet);
    expect(e.startAt).toBe("2026-12-11T13:30:00.000Z");
    expect(e.venue).toEqual(sangeet.venue);
    expect(e.isPublic).toBe(true);
  });

  it("rejects an end before the start, a 2-week event and http map links", async () => {
    const bad = async (body: object) =>
      call(events.POST, "POST", "", {
        cookie: users.owner.cookie,
        params: w(),
        body: { ...sangeet, ...body },
      });
    expect((await bad({ endAt: at("2026-12-11", "18:00") })).body.error?.fields?.endAt).toMatch(
      /after/,
    );
    expect((await bad({ endAt: at("2026-12-25", "18:00") })).body.error?.fields?.endAt).toMatch(
      /7 days/,
    );
    expect((await bad({ venue: { mapUrl: "http://maps.example" } })).status).toBe(422);
  });

  it("orders new events by start time, then keeps a manual order", async () => {
    const wedding = await addEvent({
      ...sangeet,
      name: "Wedding",
      type: "wedding",
      startAt: at("2026-12-12", "09:15"),
      endAt: at("2026-12-12", "12:00"),
    });
    const haldi = await addEvent({
      ...sangeet,
      name: "Haldi",
      type: "haldi",
      startAt: at("2026-12-10", "10:00"),
      endAt: at("2026-12-10", "12:00"),
    });
    const s = await addEvent(sangeet);
    const names = async () =>
      (
        (await call(events.GET, "GET", "", { cookie: users.viewer.cookie, params: w() })).body
          .data as EventDto[]
      ).map((e) => e.name);
    expect(await names()).toEqual(["Haldi", "Sangeet", "Wedding"]);

    const res = await call(reorder, "POST", "", {
      cookie: users.manager.cookie,
      params: w(),
      body: { ids: [wedding.id, haldi.id, s.id] },
    });
    expect(res.status).toBe(200);
    expect(await names()).toEqual(["Wedding", "Haldi", "Sangeet"]);

    const partial = await call(reorder, "POST", "", {
      cookie: users.manager.cookie,
      params: w(),
      body: { ids: [wedding.id] },
    });
    expect(partial.status).toBe(422);
  });

  it("refuses a stale edit with 409 and the current version (If-Match)", async () => {
    const e = await addEvent(sangeet);
    const patch = (cookie: string, ifMatch: string, body: object) =>
      event.PATCH(
        new NextRequest(`${APP}/api/weddings/${weddingId}/events/${e.id}`, {
          method: "PATCH",
          headers: { cookie, origin: APP, "content-type": "application/json", "if-match": ifMatch },
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ weddingId, eventId: e.id }) },
      );
    const first = await patch(users.owner.cookie, e.updatedAt, { dressCode: "Traditional" });
    expect(first.status).toBe(200);
    const second = await patch(users.manager.cookie, e.updatedAt, { dressCode: "Western" });
    expect(second.status).toBe(409);
    const body = (await second.json()) as { error: { code: string; details: EventDto } };
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.details.dressCode).toBe("Traditional");
  });

  it("checks the merged times when only one end changes", async () => {
    const e = await addEvent(sangeet);
    const res = await call(event.PATCH, "PATCH", "", {
      cookie: users.owner.cookie,
      params: { weddingId, eventId: e.id },
      body: { startAt: at("2026-12-12", "01:00") },
    });
    expect(res.status).toBe(422);
  });

  it("shows the impact, then deletes and unlinks the event's tasks", async () => {
    const e = await addEvent(sangeet);
    const t = await addTask({ title: "Book the DJ", eventId: e.id });
    const params = { weddingId, eventId: e.id };
    expect((await call(impact, "GET", "", { cookie: users.organizer.cookie, params })).status).toBe(
      403,
    );
    const preview = await call(impact, "GET", "", { cookie: users.owner.cookie, params });
    expect(preview.body.data).toEqual({ tasksUnlinked: 1, rsvpsRemoved: 0, photosMoved: 0 });

    const del = await call(event.DELETE, "DELETE", "", { cookie: users.owner.cookie, params });
    expect(del.body.data).toEqual({ tasksUnlinked: 1, rsvpsRemoved: 0, photosMoved: 0 });
    const after = await call(task.GET, "GET", "", {
      cookie: users.owner.cookie,
      params: { weddingId, taskId: t.id },
    });
    expect((after.body.data as TaskDto).eventId).toBeNull();
  });
});

describe("tasks", () => {
  it("lets organizers and up create and edit; viewers only read", async () => {
    expect(
      await asEachRole(users, (u, role) =>
        call(tasks.POST, "POST", "", {
          cookie: u.cookie,
          params: w(),
          body: { title: `Task by ${role}` },
        }),
      ),
    ).toEqual({ owner: 201, manager: 201, organizer: 201, viewer: 403, stranger: 404 });

    const t = await addTask({ title: "Order flowers" });
    expect(
      await asEachRole(users, (u) =>
        call(task.PATCH, "PATCH", "", {
          cookie: u.cookie,
          params: { weddingId, taskId: t.id },
          body: { priority: "high" },
        }),
      ),
    ).toEqual({ owner: 200, manager: 200, organizer: 200, viewer: 403, stranger: 404 });
  });

  it("lets managers delete any task but organizers only their own", async () => {
    const byOwner = await addTask({ title: "Owner's task" });
    const byOrganizer = await addTask({ title: "Organizer's task" }, users.organizer);
    const del = (u: TestUser, t: TaskDto) =>
      call(task.DELETE, "DELETE", "", { cookie: u.cookie, params: { weddingId, taskId: t.id } });
    expect((await del(users.organizer, byOwner)).status).toBe(403);
    expect((await del(users.organizer, byOrganizer)).status).toBe(204);
    expect((await del(users.manager, byOwner)).status).toBe(204);
  });

  it("only assigns members and only links this wedding's events", async () => {
    const res = await call(tasks.POST, "POST", "", {
      cookie: users.owner.cookie,
      params: w(),
      body: { title: "X", assigneeId: users.stranger.id },
    });
    expect(res.body.error?.fields?.assigneeId).toBeDefined();

    const foreign = await call(events.POST, "POST", "", {
      cookie: users.stranger.cookie,
      params: { weddingId: otherWeddingId },
      body: sangeet,
    });
    const foreignEvent = foreign.body.data as EventDto;
    const linked = await call(tasks.POST, "POST", "", {
      cookie: users.owner.cookie,
      params: w(),
      body: { title: "X", eventId: foreignEvent.id },
    });
    expect(linked.body.error?.fields?.eventId).toBeDefined();
  });

  it("filters by assignee (me), event and overdue", async () => {
    const e = await addEvent(sangeet);
    await addTask({ title: "Mine", assigneeId: users.organizer.id });
    await addTask({ title: "For the sangeet", eventId: e.id });
    await addTask({ title: "Late", dueAt: "2020-01-01" });
    await addTask({ title: "Late but done", dueAt: "2020-01-01", status: "done" });

    expect((await listTasks("?assigneeId=me", users.organizer)).map((t) => t.title)).toEqual([
      "Mine",
    ]);
    expect((await listTasks(`?eventId=${e.id}`)).map((t) => t.title)).toEqual(["For the sangeet"]);
    const overdue = await listTasks("?overdue=true");
    expect(overdue.map((t) => t.title)).toEqual(["Late"]);
    expect(overdue[0]?.overdue).toBe(true);
  });

  it("marks completion when a task is done, and clears it when reopened", async () => {
    const t = await addTask({ title: "Book the priest" });
    const done = await call(task.PATCH, "PATCH", "", {
      cookie: users.owner.cookie,
      params: { weddingId, taskId: t.id },
      body: { status: "done" },
    });
    expect((done.body.data as TaskDto).completedAt).toBeTruthy();
    const reopened = await call(task.PATCH, "PATCH", "", {
      cookie: users.owner.cookie,
      params: { weddingId, taskId: t.id },
      body: { status: "todo" },
    });
    expect((reopened.body.data as TaskDto).completedAt).toBeNull();
  });
});

describe("the board", () => {
  async function board(status = "todo") {
    return (await listTasks(`?status=${status}`)).map((t) => t.title);
  }
  const moveTo = (t: TaskDto, body: object, ifMatch?: string) =>
    move(
      new NextRequest(`${APP}/api/weddings/${weddingId}/tasks/${t.id}/move`, {
        method: "POST",
        headers: {
          cookie: users.organizer.cookie,
          origin: APP,
          "content-type": "application/json",
          ...(ifMatch ? { "if-match": ifMatch } : {}),
        },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ weddingId, taskId: t.id }) },
    );

  it("moves a card between neighbours and across columns", async () => {
    const a = await addTask({ title: "A" });
    const b = await addTask({ title: "B" });
    const c = await addTask({ title: "C" });
    expect(await board()).toEqual(["A", "B", "C"]);

    expect((await moveTo(c, { status: "todo", beforeId: a.id, afterId: b.id })).status).toBe(200);
    expect(await board()).toEqual(["A", "C", "B"]);

    expect((await moveTo(a, { status: "done", beforeId: null, afterId: null })).status).toBe(200);
    expect(await board()).toEqual(["C", "B"]);
    expect(await board("done")).toEqual(["A"]);
  });

  it("keeps working when the same gap is split many times", async () => {
    const a = await addTask({ title: "A" });
    const z = await addTask({ title: "Z" });
    let above = a;
    for (let i = 0; i < 60; i++) {
      const t = await addTask({ title: `T${String(i)}` });
      expect((await moveTo(t, { status: "todo", beforeId: above.id, afterId: z.id })).status).toBe(
        200,
      );
      above = t;
    }
    const titles = await board();
    expect(titles[0]).toBe("A");
    expect(titles.at(-1)).toBe("Z");
    expect(titles.at(-2)).toBe("T59");
  });

  it("refuses a stale move (If-Match) and neighbours from another column", async () => {
    const a = await addTask({ title: "A" });
    const b = await addTask({ title: "B", status: "done" });
    const stale = await moveTo(
      a,
      { status: "in_progress", beforeId: null, afterId: null },
      "2020-01-01T00:00:00.000Z",
    );
    expect(stale.status).toBe(409);
    const wrongColumn = await moveTo(a, { status: "todo", beforeId: b.id, afterId: null });
    expect(wrongColumn.status).toBe(422);
  });
});

describe("starter checklists", () => {
  it("previews items with due dates counted back from the event", async () => {
    const e = await addEvent(sangeet);
    const res = await call(
      checklists,
      "GET",
      `/api/weddings/${weddingId}/checklists?eventId=${e.id}`,
      { cookie: users.organizer.cookie, params: w() },
    );
    const data = res.body.data as {
      target: { date: string };
      items: { id: string; dueAt: string }[];
    };
    expect(data.target.date).toBe("2026-12-11");
    expect(data.items.find((i) => i.id === "sangeet-stage")?.dueAt).toBe("2026-11-20");
  });

  it("imports ticked items as tasks linked to the event; viewers can't", async () => {
    const e = await addEvent(sangeet);
    const body = { eventId: e.id, itemIds: ["sangeet-dj", "sangeet-emcee", "not-a-real-item"] };
    expect(
      (await call(importChecklist, "POST", "", { cookie: users.viewer.cookie, params: w(), body }))
        .status,
    ).toBe(403);
    const res = await call(importChecklist, "POST", "", {
      cookie: users.organizer.cookie,
      params: w(),
      body,
    });
    expect(res.status).toBe(201);
    const created = res.body.data as TaskDto[];
    expect(created.map((t) => t.title)).toEqual(["Book the DJ and sound", "Choose an emcee"]);
    expect(created.every((t) => t.eventId === e.id)).toBe(true);
  });

  it("dates the general checklist from the main wedding date, never in the past", async () => {
    const res = await call(importChecklist, "POST", "", {
      cookie: users.owner.cookie,
      params: w(),
      body: { eventId: null, itemIds: ["gen-muhurtham", "gen-headcount"] },
    });
    const [muhurtham, headcount] = res.body.data as TaskDto[];
    // 180 days before 12 Dec 2026 has already passed in these tests, so it becomes today.
    expect(muhurtham?.dueAt && muhurtham.dueAt <= "2026-12-12").toBe(true);
    expect(headcount?.dueAt).toBe("2026-12-05");
  });
});

describe("summary and isolation", () => {
  it("counts events and tasks for the dashboard", async () => {
    await addEvent(sangeet);
    await addTask({ title: "Open" });
    await addTask({ title: "Late", dueAt: "2020-01-01" });
    await addTask({ title: "Done", status: "done" });
    const res = await call(summary, "GET", "", { cookie: users.viewer.cookie, params: w() });
    expect(res.body.data).toMatchObject({
      events: 1,
      tasks: { todo: 2, in_progress: 0, done: 1, overdue: 1 },
    });
  });

  it("never lets one wedding reach another's events or tasks", async () => {
    const e = await addEvent(sangeet);
    const t = await addTask({ title: "Private" });
    const asStranger = { cookie: users.stranger.cookie };
    expect(
      (await call(event.GET, "GET", "", { ...asStranger, params: { weddingId, eventId: e.id } }))
        .status,
    ).toBe(404);
    expect(
      (await call(task.GET, "GET", "", { ...asStranger, params: { weddingId, taskId: t.id } }))
        .status,
    ).toBe(404);
    // The stranger's own wedding id with our event's id: still not found.
    expect(
      (
        await call(event.GET, "GET", "", {
          ...asStranger,
          params: { weddingId: otherWeddingId, eventId: e.id },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await call(task.PATCH, "PATCH", "", {
          ...asStranger,
          params: { weddingId: otherWeddingId, taskId: t.id },
          body: { title: "hacked" },
        })
      ).status,
    ).toBe(404);
  });
});
