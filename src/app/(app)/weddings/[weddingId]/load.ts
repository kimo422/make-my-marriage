import "server-only";

import { notFound } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import type { Permission } from "@/modules/members";
import { requireAccess, type WeddingContext } from "@/modules/weddings";

/**
 * Page-side twin of the API's access check: signed-out visitors go to sign-in,
 * and anything the API would answer 404 or 403 renders Next.js's 404 page.
 */
export async function loadWedding(
  weddingId: string,
  returnTo: string,
  permission: Permission = "wedding.view",
): Promise<WeddingContext> {
  const user = await getCurrentUser(returnTo);
  try {
    return await requireAccess(user, weddingId, permission);
  } catch (error) {
    if (error instanceof AppError && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  }
}
