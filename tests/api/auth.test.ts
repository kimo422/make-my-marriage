import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as authGet, POST as authPost } from "@/app/api/auth/[...all]/route";
import { GET as meGet, PATCH as mePatch } from "@/app/api/me/route";
import type { EmailMessage } from "@/lib/email/send";
import type { ApiData, ApiError } from "@/lib/types/api";
import type { MeResponse } from "@/modules/auth";
import { useTestDb } from "@tests/helpers/db";

// Capture outgoing email instead of sending it.
const sent = vi.hoisted(() => [] as EmailMessage[]);
vi.mock("@/lib/email/send", () => ({
  sendEmail: (message: EmailMessage) => {
    sent.push(message);
    return Promise.resolve();
  },
}));

const APP = "http://localhost:3000";
const noParams = { params: Promise.resolve({}) };

function authRequest(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${APP}/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: APP, ...headers },
    body: JSON.stringify(body),
  });
}

/** The session cookie(s) from a Better Auth response, as a Cookie header value. */
function cookieFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function signUp(email = "santhvana@example.com", password = "a-strong-password") {
  const res = await authPost(authRequest("/sign-up/email", { name: "Santhvana", email, password }));
  return { res, cookie: cookieFrom(res) };
}

function me(cookie?: string) {
  return meGet(new NextRequest(`${APP}/api/me`, { headers: cookie ? { cookie } : {} }), noParams);
}

let db: Awaited<ReturnType<typeof useTestDb>>;

beforeAll(async () => {
  db = await useTestDb();
});
beforeEach(async () => {
  sent.length = 0;
  await db.clear();
});
afterAll(async () => {
  await db.drop();
});

describe("sign-up and sign-in", () => {
  it("creates an account and signs it in straight away (no verification step)", async () => {
    const { res, cookie } = await signUp();
    expect(res.status).toBe(200);
    expect(cookie).toContain("session_token");

    const body = (await (await me(cookie)).json()) as ApiData<MeResponse>;
    expect(body.data.user).toMatchObject({ name: "Santhvana", email: "santhvana@example.com" });
    expect(body.data.weddings).toEqual([]);
  });

  it("stores the email lowercased and rejects a second account for it", async () => {
    await signUp("Santhvana@Example.com");
    const { res } = await signUp("santhvana@example.com");
    expect(res.status).toBe(422);
    expect(((await res.json()) as { code: string }).code).toMatch(/^USER_ALREADY_EXISTS/);
  });

  it("rejects passwords shorter than 8 characters", async () => {
    const { res } = await signUp("short@example.com", "1234567");
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("PASSWORD_TOO_SHORT");
  });

  it("signs in with the right password only", async () => {
    await signUp();
    const wrong = await authPost(
      authRequest("/sign-in/email", { email: "santhvana@example.com", password: "nope-nope" }),
    );
    expect(wrong.status).toBe(401);
    expect(((await wrong.json()) as { code: string }).code).toBe("INVALID_EMAIL_OR_PASSWORD");

    const right = await authPost(
      authRequest("/sign-in/email", {
        email: "santhvana@example.com",
        password: "a-strong-password",
      }),
    );
    expect(right.status).toBe(200);
    expect(cookieFrom(right)).toContain("session_token");
  });

  it("blocks auth requests from another origin", async () => {
    const res = await authPost(
      authRequest(
        "/sign-up/email",
        { name: "X", email: "x@example.com", password: "a-strong-password" },
        { origin: "https://evil.example" },
      ),
    );
    expect(res.status).toBe(403);
  });

  it("signs out and invalidates the session", async () => {
    const { cookie } = await signUp();
    const out = await authPost(authRequest("/sign-out", {}, { cookie }));
    expect(out.status).toBe(200);
    expect((await me(cookie)).status).toBe(401);
  });
});

describe("/api/me", () => {
  it("returns 401 without a session", async () => {
    const res = await me();
    expect(res.status).toBe(401);
    expect(((await res.json()) as ApiError).error.code).toBe("UNAUTHENTICATED");
  });

  it("updates the display name", async () => {
    const { cookie } = await signUp();
    const res = await mePatch(
      new NextRequest(`${APP}/api/me`, {
        method: "PATCH",
        headers: { cookie, origin: APP, "content-type": "application/json" },
        body: JSON.stringify({ name: "Santhvana Rao" }),
      }),
      noParams,
    );
    expect(res.status).toBe(200);
    const body = (await (await me(cookie)).json()) as ApiData<MeResponse>;
    expect(body.data.user.name).toBe("Santhvana Rao");
  });

  it("rejects unknown fields, so email can't be changed this way", async () => {
    const { cookie } = await signUp();
    const res = await mePatch(
      new NextRequest(`${APP}/api/me`, {
        method: "PATCH",
        headers: { cookie, origin: APP, "content-type": "application/json" },
        body: JSON.stringify({ name: "S", email: "other@example.com" }),
      }),
      noParams,
    );
    expect(res.status).toBe(422);
  });
});

describe("password reset", () => {
  it("emails a 1-hour link, sets the new password and signs out other sessions", async () => {
    const { cookie: oldSession } = await signUp();

    const requested = await authPost(
      authRequest("/request-password-reset", {
        email: "santhvana@example.com",
        redirectTo: "/reset-password",
      }),
    );
    expect(requested.status).toBe(200);
    expect(sent).toHaveLength(1);
    const email = sent[0];
    expect(email?.to).toBe("santhvana@example.com");

    // The emailed link checks the token, then redirects to our page with ?token=…
    const link = /https?:\/\/\S+\/api\/auth\/reset-password\/\S+/.exec(email?.text ?? "")?.[0];
    expect(link).toBeDefined();
    const landing = await authGet(new Request(link ?? ""));
    expect(landing.status).toBe(302);
    const location = new URL(landing.headers.get("location") ?? "", APP);
    expect(location.pathname).toBe("/reset-password");
    const token = location.searchParams.get("token");
    expect(token).toBeTruthy();

    const reset = await authPost(
      authRequest("/reset-password", { newPassword: "a-new-strong-password", token }),
    );
    expect(reset.status).toBe(200);

    expect((await me(oldSession)).status).toBe(401);
    const signIn = await authPost(
      authRequest("/sign-in/email", {
        email: "santhvana@example.com",
        password: "a-new-strong-password",
      }),
    );
    expect(signIn.status).toBe(200);
  });

  it("answers the same for an unknown email and sends nothing", async () => {
    const res = await authPost(
      authRequest("/request-password-reset", {
        email: "nobody@example.com",
        redirectTo: "/reset-password",
      }),
    );
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(0);
  });

  it("rejects a made-up token", async () => {
    const res = await authPost(
      authRequest("/reset-password", { newPassword: "a-new-strong-password", token: "bogus" }),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("INVALID_TOKEN");
  });
});
