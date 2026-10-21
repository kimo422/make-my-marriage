import "server-only";

import { isAPIError } from "better-auth/api";

import { getAuth } from "@/lib/auth/server";
import type { SessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { removeAllMembershipsForUser } from "@/modules/members";
import { listMyWeddings, soleOwnedWeddings } from "@/modules/weddings";

import type { UpdateMeInput } from "./schema";
import type { MeResponse } from "./types";

export async function getMe(user: SessionUser): Promise<MeResponse> {
  return { user, weddings: await listMyWeddings(user) };
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

/**
 * Deletes the account after checking the password. Refused while the user is
 * the only owner of any wedding, since that wedding would be left with nobody
 * able to manage or delete it.
 */
export async function deleteMe(
  user: SessionUser,
  password: string,
  requestHeaders: Headers,
): Promise<void> {
  const sole = await soleOwnedWeddings(user.id);
  if (sole.length > 0) {
    const names = sole.map((w) => `${w.brideName} & ${w.groomName}`).join(", ");
    throw new AppError(
      "SOLE_OWNER",
      `You're the only owner of ${names}. Make someone else an owner, or delete the wedding, first.`,
      { details: { weddingIds: sole.map((w) => w.id) } },
    );
  }

  const auth = await getAuth();
  try {
    await auth.api.deleteUser({ body: { password }, headers: requestHeaders });
  } catch (error) {
    if (isAPIError(error) && error.body?.code === "INVALID_PASSWORD") {
      throw new AppError("VALIDATION_FAILED", "That password isn't right", {
        fields: { password: "That password isn't right" },
      });
    }
    throw error;
  }
  await removeAllMembershipsForUser(user.id);
}
