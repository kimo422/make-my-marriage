import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "@/lib/auth/server";
import { unauthenticated } from "@/lib/errors";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

async function readSession(requestHeaders: Headers): Promise<SessionUser | null> {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const { id, name, email } = session.user;
  return { id, name, email };
}

/** For API route handlers: the signed-in user, or a 401 UNAUTHENTICATED. */
export async function requireUser(request: Request): Promise<SessionUser> {
  const user = await readSession(request.headers);
  if (!user) throw unauthenticated();
  return user;
}

/**
 * For pages: the signed-in user, or a redirect to sign-in that returns here.
 * Reads the request, so call it from a component inside a <Suspense> boundary.
 */
export async function getCurrentUser(returnTo: string): Promise<SessionUser> {
  const user = await readSession(await headers());
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return user;
}
