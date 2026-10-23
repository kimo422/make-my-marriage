import "server-only";

import { env } from "@/lib/env/server";
import { AppError, notFound } from "@/lib/errors";
import { hashSecret, sameSignature, signValue, verifySecret } from "@/lib/tokens";
import { logActivity } from "@/modules/activity";
import { listWeddingEvents } from "@/modules/events";

import * as repo from "./repo";
import type { WebsiteSettingsInput } from "./schema";
import type { WeddingContext } from "./service";
import type { PublicSiteDto, WebsiteSettingsDto } from "./types";

// The public wedding website (FR-8.1–8.4) at /site/<slug>. Unpublished sites
// are 404. A password, when set, is checked once per browser; a signed cookie
// then remembers it for 12 hours (API Design, "Wedding website").

export const SITE_UNLOCK_HOURS = 12;

export function siteUrl(slug: string): string {
  return `${env.APP_URL}/site/${slug}`;
}

function toSettings(website: repo.WebsiteRecord, slug: string): WebsiteSettingsDto {
  return {
    published: website.published,
    story: website.story,
    passwordProtected: website.passwordHash !== null,
    indexable: website.indexable,
    publishedAt: website.publishedAt,
    url: siteUrl(slug),
  };
}

export async function getWebsiteSettings(ctx: WeddingContext): Promise<WebsiteSettingsDto> {
  const website = await repo.findWebsite(ctx.wedding.id);
  if (!website) throw notFound();
  return toSettings(website, ctx.wedding.slug);
}

export async function updateWebsiteSettings(
  ctx: WeddingContext,
  input: WebsiteSettingsInput,
): Promise<WebsiteSettingsDto> {
  const before = await repo.findWebsite(ctx.wedding.id);
  if (!before) throw notFound();
  const publishing = input.published === true && !before.published;
  const updated = await repo.updateWebsite(ctx.wedding.id, {
    published: input.published,
    story: input.story,
    indexable: input.indexable,
    passwordHash:
      input.password === undefined ? undefined : input.password && hashSecret(input.password),
    publishedAt: publishing ? new Date() : undefined,
  });
  if (!updated) throw notFound();

  const what =
    input.published === undefined || input.published === before.published
      ? "updated the wedding website"
      : input.published
        ? "published the wedding website"
        : "took the wedding website offline";
  await logActivity({
    weddingId: ctx.wedding.id,
    actorId: ctx.user.id,
    actorLabel: ctx.user.name,
    action: "updated",
    entity: "wedding",
    entityId: ctx.wedding.id,
    summary: `${ctx.user.name} ${what}`,
  });
  return toSettings(updated, ctx.wedding.slug);
}

// The unlock cookie: "<expiry>.<signature>". The signature covers the
// password's hash, so changing or removing the password logs everyone out.

export function siteCookieName(weddingId: string): string {
  return `mmm_site_${weddingId}`;
}

function signature(weddingId: string, passwordHash: string, expires: number): string {
  return signValue(`site:${weddingId}:${passwordHash}:${String(expires)}`);
}

function cookieIsValid(weddingId: string, passwordHash: string, value: string | undefined) {
  if (!value) return false;
  const [expires, sig] = value.split(".");
  const at = Number(expires);
  if (!sig || !Number.isFinite(at) || at < Date.now()) return false;
  return sameSignature(sig, signature(weddingId, passwordHash, at));
}

async function findPublished(slug: string) {
  const found = await repo.findWeddingBySlug(slug);
  return found?.website.published ? found : null;
}

/**
 * The site for a visitor, or null when it doesn't exist or isn't published.
 * `readCookie` gives the visitor's unlock cookie, if any.
 */
export async function getPublicSite(
  slug: string,
  readCookie: (name: string) => string | undefined,
): Promise<PublicSiteDto | null> {
  const found = await findPublished(slug);
  if (!found) return null;
  const { wedding, website } = found;
  if (
    website.passwordHash &&
    !cookieIsValid(wedding.id, website.passwordHash, readCookie(siteCookieName(wedding.id)))
  ) {
    return { locked: true, brideName: wedding.brideName, groomName: wedding.groomName };
  }
  const events = (await listWeddingEvents(wedding.id)).filter((e) => e.isPublic);
  return {
    locked: false,
    brideName: wedding.brideName,
    groomName: wedding.groomName,
    primaryDate: wedding.primaryDate,
    city: wedding.city,
    tradition: wedding.tradition,
    timezone: wedding.timezone,
    story: website.story,
    indexable: website.indexable,
    events: events.map((e) => ({
      id: e.id,
      name: e.name,
      startAt: e.startAt,
      endAt: e.endAt,
      venue: e.venue,
      dressCode: e.dressCode,
    })),
  };
}

/**
 * What the page head and link preview need, without unlocking anything: the
 * couple, the date, and whether search engines may index it. Null unless published.
 */
export async function getSiteCard(slug: string) {
  const found = await findPublished(slug);
  if (!found) return null;
  const { wedding, website } = found;
  return {
    wedding,
    // A password-protected site is never indexed, whatever the toggle says.
    indexable: website.indexable && website.passwordHash === null,
  };
}

/** Checks the password and returns the cookie that keeps this browser unlocked. */
export async function unlockSite(
  slug: string,
  password: string,
): Promise<{ name: string; value: string; maxAge: number }> {
  const found = await findPublished(slug);
  if (!found) throw notFound();
  const { wedding, website } = found;
  if (!website.passwordHash) throw new AppError("BAD_REQUEST", "This website has no password");
  if (!verifySecret(password, website.passwordHash)) {
    throw new AppError("VALIDATION_FAILED", "That password isn't right", {
      fields: { password: "That password isn't right" },
    });
  }
  const maxAge = SITE_UNLOCK_HOURS * 3600;
  const expires = Date.now() + maxAge * 1000;
  return {
    name: siteCookieName(wedding.id),
    value: `${String(expires)}.${signature(wedding.id, website.passwordHash, expires)}`,
    maxAge,
  };
}
