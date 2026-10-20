import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GET } from "@/app/api/health/route";
import { useTestDb } from "@tests/helpers/db";

let db: Awaited<ReturnType<typeof useTestDb>>;

beforeAll(async () => {
  db = await useTestDb();
});
afterAll(async () => {
  await db.drop();
});

describe("GET /api/health", () => {
  it("reports MongoDB as reachable", async () => {
    const res = await GET(new NextRequest("http://localhost:3000/api/health"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { status: "ok", checks: { mongo: "ok" } } });
  });
});
