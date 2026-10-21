import "server-only";

import { env } from "@/lib/env/server";

/**
 * The app's own origins: APP_URL, plus the per-deployment URLs Vercel sets on
 * previews so pull-request builds can make mutations against themselves.
 * Shared by the API's Origin check and Better Auth's trusted origins.
 */
export function allowedOrigins(): string[] {
  const origins = new Set([new URL(env.APP_URL).origin]);
  for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) {
    if (host) origins.add(`https://${host}`);
  }
  return [...origins];
}
