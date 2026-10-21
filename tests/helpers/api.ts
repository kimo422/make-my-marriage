import { NextRequest } from "next/server";

import { POST as authPost } from "@/app/api/auth/[...all]/route";

export const APP = "http://localhost:3000";

type RouteHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) => Promise<Response>;

/** Calls a route handler the way Next.js would, as a same-origin browser request. */
export async function call(
  handler: unknown,
  method: string,
  path: string,
  options: { cookie?: string; body?: unknown; params?: Record<string, string> } = {},
): Promise<{
  status: number;
  body: {
    data?: unknown;
    error?: { code: string; fields?: Record<string, string> };
    page?: unknown;
  };
}> {
  const headers: Record<string, string> = { origin: APP };
  if (options.cookie) headers.cookie = options.cookie;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const res = await (handler as RouteHandler)(
    new NextRequest(`${APP}${path}`, {
      method,
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    }),
    { params: Promise.resolve(options.params ?? {}) },
  );
  const text = await res.text();
  return { status: res.status, body: text ? (JSON.parse(text) as never) : {} };
}

export interface TestUser {
  id: string;
  name: string;
  email: string;
  cookie: string;
}

/** Signs a new user up through Better Auth and returns their session cookie. */
export async function signUpUser(
  name: string,
  email: string,
  password = "a-strong-password",
): Promise<TestUser> {
  const res = await authPost(
    new Request(`${APP}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: APP },
      body: JSON.stringify({ name, email, password }),
    }),
  );
  if (res.status !== 200)
    throw new Error(`sign-up failed: ${String(res.status)} ${await res.text()}`);
  const body = (await res.json()) as { user: { id: string } };
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return { id: body.user.id, name, email, cookie };
}
