import "server-only";

import type { DbSession } from "@/lib/db/connect";

import { insertActivity, listActivity, type NewActivity } from "./repo";
import type { ActivityDto } from "./types";

export type { NewActivity };

/** Records one entry. Pass the transaction session when the change itself is transactional. */
export function logActivity(entry: NewActivity, session?: DbSession): Promise<void> {
  return insertActivity(entry, session);
}

/** The wedding's feed. Callers check `activity.view` first (weddings.requireAccess). */
export function listWeddingActivity(
  weddingId: string,
  page: { limit: number; cursor?: string | undefined },
): Promise<{ items: ActivityDto[]; nextCursor: string | null }> {
  return listActivity(weddingId, page);
}
