import "server-only";

import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { list, parseParams, parseQuery, route } from "@/lib/http";
import { cursorQuery, objectId } from "@/lib/validation/common";
import { requireAccess } from "@/modules/weddings";

import { listWeddingActivity } from "./service";

/** GET /api/weddings/:weddingId/activity: newest first, cursor paged (min role: viewer). */
export const activityFeedHandler = route<{ weddingId: string }>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, z.object({ weddingId: objectId }));
  await requireAccess(user, weddingId, "activity.view");
  const page = parseQuery(request, cursorQuery);
  const { items, nextCursor } = await listWeddingActivity(weddingId, page);
  return list(items, nextCursor);
});
