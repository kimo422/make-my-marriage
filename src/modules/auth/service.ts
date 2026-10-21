import "server-only";

import { getAuth } from "@/lib/auth/server";
import type { SessionUser } from "@/lib/auth/session";

import type { UpdateMeInput } from "./schema";
import type { MeResponse } from "./types";

export function getMe(user: SessionUser): MeResponse {
  // Memberships arrive with the weddings module in Phase 2.
  return { user, weddings: [] };
}

/** Updates the signed-in user's display name through Better Auth. */
export async function updateMe(
  user: SessionUser,
  input: UpdateMeInput,
  requestHeaders: Headers,
): Promise<MeResponse> {
  const auth = await getAuth();
  await auth.api.updateUser({ body: { name: input.name }, headers: requestHeaders });
  return getMe({ ...user, name: input.name });
}
