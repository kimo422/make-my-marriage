import type { ReactNode } from "react";

import { getCurrentUser, type SessionUser } from "@/lib/auth/session";

/**
 * Server-side session check for a page section. Redirects to sign-in when
 * there's no valid session; otherwise renders `children(user)`. Place it inside
 * a <Suspense> boundary, since it reads the request.
 */
export async function RequireUser({
  returnTo,
  children,
}: {
  returnTo: string;
  children: (user: SessionUser) => ReactNode;
}) {
  const user = await getCurrentUser(returnTo);
  return children(user);
}
