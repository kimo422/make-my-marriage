import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AppError } from "@/lib/errors";
import { ok, parseJson, parseParams, route } from "@/lib/http";
import type { ApiError } from "@/lib/types/api";
import { objectId } from "@/lib/validation/common";

const APP = "http://localhost:3000";
const noParams = { params: Promise.resolve({}) };

function request(method: string, init: { body?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(`${APP}/api/test`, { method, ...init });
}

const echo = route(async (req) => {
  const body = await parseJson(req, z.object({ name: z.string().min(1) }).strict());
  return ok(body);
});

describe("route()", () => {
  it("adds a request id and no-store caching to every response", async () => {
    const res = await route(() => Promise.resolve(ok({ hi: true })))(request("GET"), noParams);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Request-Id")).toMatch(/^[\da-f-]{36}$/);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("blocks mutations without a same-origin Origin header", async () => {
    for (const headers of [{}, { origin: "https://evil.example" }] as Record<string, string>[]) {
      const res = await echo(request("POST", { body: "{}", headers }), noParams);
      expect(res.status).toBe(403);
    }
  });

  it("accepts a same-origin JSON mutation", async () => {
    const res = await echo(
      request("POST", {
        body: JSON.stringify({ name: "Ananya" }),
        headers: { origin: APP, "content-type": "application/json" },
      }),
      noParams,
    );
    expect(await res.json()).toEqual({ data: { name: "Ananya" } });
  });

  it("returns 400 for malformed JSON and 422 with fields for invalid input", async () => {
    const headers = { origin: APP, "content-type": "application/json" };
    const bad = await echo(request("POST", { body: "{nope", headers }), noParams);
    expect(bad.status).toBe(400);

    const invalid = await echo(request("POST", { body: '{"name":""}', headers }), noParams);
    const body = (await invalid.json()) as ApiError;
    expect(invalid.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.fields).toHaveProperty("name");
  });

  it("strips $-prefixed keys before validation", async () => {
    const res = await echo(
      request("POST", {
        body: JSON.stringify({ name: "Rohan", $where: "1" }),
        headers: { origin: APP, "content-type": "application/json" },
      }),
      noParams,
    );
    expect(res.status).toBe(200);
  });

  it("maps AppError to its status and code", async () => {
    const res = await route(() => {
      throw new AppError("RSVP_CLOSED", "RSVPs are closed");
    })(request("GET"), noParams);
    expect(res.status).toBe(409);
    expect(((await res.json()) as ApiError).error.code).toBe("RSVP_CLOSED");
  });

  it("hides unexpected errors behind INTERNAL with a request id", async () => {
    const res = await route(() => {
      throw new Error("db password is hunter2");
    })(request("GET"), noParams);
    const body = (await res.json()) as ApiError;
    expect(res.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL");
    expect(JSON.stringify(body)).not.toContain("hunter2");
    expect(body.error.requestId).toBe(res.headers.get("X-Request-Id"));
  });
});

describe("parseParams()", () => {
  it("reports a malformed id as NOT_FOUND", () => {
    expect(() => parseParams({ id: "nope" }, z.object({ id: objectId }))).toThrow(
      expect.objectContaining({ code: "NOT_FOUND" }) as Error,
    );
  });
});
