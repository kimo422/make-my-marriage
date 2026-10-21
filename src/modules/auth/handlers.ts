import "server-only";

import { getAuth } from "@/lib/auth/server";
import { requireUser } from "@/lib/auth/session";
import { noContent, ok, parseJson, route } from "@/lib/http";
import { allowedOrigins } from "@/lib/http/origins";

import { deleteMeSchema, updateMeSchema } from "./schema";
import { deleteMe, getMe, updateMe } from "./service";

/**
 * Better Auth's own endpoints (/api/auth/*: sign-up, sign-in, sign-out,
 * get-session, password reset). They keep Better Auth's response format and
 * rate limits, so they bypass route().
 *
 * Better Auth checks Origin only when a session cookie is present; the API
 * rule is stricter, so every POST must come from the app's own origin. That
 * also blocks login CSRF (another site signing a visitor into an attacker's account).
 */
export async function authHandler(request: Request): Promise<Response> {
  if (request.method === "POST") {
    const origin = request.headers.get("origin");
    if (!origin || !allowedOrigins().includes(origin)) {
      return Response.json(
        { code: "FORBIDDEN", message: "Cross-origin request blocked" },
        { status: 403 },
      );
    }
  }
  const auth = await getAuth();
  return auth.handler(request);
}

/** GET /api/me: the signed-in user and the weddings they belong to. */
export const getMeHandler = route(async (request) => {
  const user = await requireUser(request);
  return ok(await getMe(user));
});

/** DELETE /api/me: { password }. Refused with 409 SOLE_OWNER while the user is a wedding's only owner. */
export const deleteMeHandler = route(async (request) => {
  const user = await requireUser(request);
  const { password } = await parseJson(request, deleteMeSchema);
  await deleteMe(user, password, request.headers);
  return noContent();
});

/** PATCH /api/me: change the display name. */
export const patchMeHandler = route(async (request) => {
  const user = await requireUser(request);
  const input = await parseJson(request, updateMeSchema);
  return ok(await updateMe(user, input, request.headers));
});
