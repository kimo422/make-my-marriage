import "server-only";

import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { env } from "@/lib/env/server";
import { notFound } from "@/lib/errors";
import { created, noContent, ok, parseJson, parseParams, parseQuery, route } from "@/lib/http";
import { renderInviteCard } from "@/lib/invite-card";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { objectId } from "@/lib/validation/common";

import {
  createWeddingSchema,
  deleteWeddingSchema,
  siteUnlockSchema,
  slugField,
  slugQuerySchema,
  updateWeddingSchema,
  websiteSettingsSchema,
} from "./schema";
import {
  checkSlug,
  createWedding,
  deleteWedding,
  getSummary,
  requireAccess,
  restoreWedding,
  toMyWedding,
  updateWedding,
} from "./service";
import { getPublicSite, getWebsiteSettings, unlockSite, updateWebsiteSettings } from "./website";

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

/** GET /api/weddings/:weddingId/summary: dashboard numbers (min role: viewer). */
export const summaryHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  return ok(await getSummary(await requireAccess(user, weddingId, "wedding.view")));
});

/** POST /api/weddings/:weddingId/restore (owner, within 30 days of deleting). */
export const restoreWeddingHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  const ctx = await requireAccess(user, weddingId, "wedding.delete", { allowDeleted: true });
  return ok(await restoreWedding(ctx));
});

// Wedding website and invite card

/** GET /api/weddings/:weddingId/website: settings for the dashboard (min role: viewer). */
export const getWebsiteHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  return ok(await getWebsiteSettings(await requireAccess(user, weddingId, "wedding.view")));
});

/** PATCH /api/weddings/:weddingId/website: publish, story, password, indexing (manager). */
export const patchWebsiteHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  const ctx = await requireAccess(user, weddingId, "website.edit");
  return ok(await updateWebsiteSettings(ctx, await parseJson(request, websiteSettingsSchema)));
});

const cardQuerySchema = z.object({ format: z.enum(["portrait", "landscape"]).default("portrait") });

/** GET /api/weddings/:weddingId/invite-card?format=: the PNG to share on WhatsApp (viewer). */
export const inviteCardHandler = route<WeddingParams>(async (request, { params }) => {
  const user = await requireUser(request);
  const { weddingId } = parseParams(params, weddingParams);
  const { wedding } = await requireAccess(user, weddingId, "wedding.view");
  const { format } = parseQuery(request, cardQuerySchema);
  return renderInviteCard(wedding, format, {
    "Content-Disposition": `inline; filename="invite-${wedding.slug}.png"`,
  });
});

type SlugParams = { slug: string };
const slugParams = z.object({ slug: slugField });

/** GET /api/public/site/:slug: the published website, or `locked` until the password is given. */
export const getPublicSiteHandler = route<SlugParams>(async (request, { params }) => {
  await rateLimit(`public:${clientIp(request)}`, 120, 60);
  const { slug } = parseParams(params, slugParams);
  const site = await getPublicSite(slug, (name) => request.cookies.get(name)?.value);
  if (!site) throw notFound("This website isn't available");
  return ok(site);
});

/** POST /api/public/site/:slug/unlock: { password }; sets a signed 12-hour cookie. */
export const unlockSiteHandler = route<SlugParams>(async (request, { params }) => {
  const { slug } = parseParams(params, slugParams);
  // Ten tries per 15 minutes per visitor and site, so the password can't be guessed by brute force.
  await rateLimit(`site-unlock:${slug}:${clientIp(request)}`, 10, 15 * 60);
  const { password } = await parseJson(request, siteUnlockSchema);
  const cookie = await unlockSite(slug, password);
  const secure = new URL(env.APP_URL).protocol === "https:" ? "; Secure" : "";
  return new Response(null, {
    status: 204,
    headers: {
      "Set-Cookie": `${cookie.name}=${cookie.value}; Path=/; Max-Age=${String(cookie.maxAge)}; HttpOnly; SameSite=Lax${secure}`,
    },
  });
});
