import "server-only";

import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { created, noContent, ok, parseJson, parseParams, parseQuery, route } from "@/lib/http";
import { objectId } from "@/lib/validation/common";

import {
  createWeddingSchema,
  deleteWeddingSchema,
  slugQuerySchema,
  updateWeddingSchema,
} from "./schema";
import {
  checkSlug,
  createWedding,
  deleteWedding,
  requireAccess,
  restoreWedding,
  toMyWedding,
  updateWedding,
} from "./service";

type WeddingParams = { weddingId: string };
const weddingParams = z.object({ weddingId: objectId });

/** POST /api/weddings: create a wedding; the caller becomes its owner. */
export const createWeddingHandler = route(async (request) => {
  const user = await requireUser(request);
  const input = await parseJson(request, createWeddingSchema);
  return created(await createWedding(user, input));
});

/** GET /api/weddings/slug-availability?slug=: live check for the create and settings forms. */
export const slugAvailabilityHandler = route(async (request) => {
  await requireUser(request);
  const { slug } = parseQuery(request, slugQuerySchema);
  return ok(await checkSlug(slug));
});

/** GET /api/weddings/:weddingId (min role: viewer). */
export const getWeddingHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  return ok(toMyWedding(await requireAccess(user, weddingId, "wedding.view")));
});

/** PATCH /api/weddings/:weddingId (min role: manager). */
export const patchWeddingHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  const ctx = await requireAccess(user, weddingId, "wedding.edit");
  return ok(await updateWedding(ctx, await parseJson(request, updateWeddingSchema)));
});

/** DELETE /api/weddings/:weddingId (owner): body repeats the slug to confirm. */
export const deleteWeddingHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  const ctx = await requireAccess(user, weddingId, "wedding.delete");
  const { slug } = await parseJson(request, deleteWeddingSchema);
  await deleteWedding(ctx, slug);
  return noContent();
});

/** POST /api/weddings/:weddingId/restore (owner, within 30 days of deleting). */
export const restoreWeddingHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  const ctx = await requireAccess(user, weddingId, "wedding.delete", { allowDeleted: true });
  return ok(await restoreWedding(ctx));
});
