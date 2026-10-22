import "server-only";

import { connectDb } from "@/lib/db/connect";
import { AppError } from "@/lib/errors";

// Fixed-window counters in the `rateLimits` collection (Database Design,
// "rateLimits"), shared by every function instance. A TTL index clears them.

interface Counter {
  key: string;
  count: number;
  expiresAt: Date;
}

/**
 * Counts one hit for `key` and throws 429 RATE_LIMITED (with Retry-After)
 * once `limit` is passed within the window.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const { connection } = await connectDb();
  const db = connection.db;
  if (!db) return;
  const now = Date.now();
  const windowStart = Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000;
  const windowKey = `${key}:${String(windowStart)}`;
  const doc = await db.collection<Counter>("rateLimits").findOneAndUpdate(
    { key: windowKey },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date(windowStart + windowSeconds * 1000) },
    },
    { upsert: true, returnDocument: "after" },
  );
  if (doc && doc.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((windowStart + windowSeconds * 1000 - now) / 1000));
    throw new AppError("RATE_LIMITED", "Too many requests. Please wait a little and try again.", {
      headers: { "Retry-After": String(retryAfter) },
    });
  }
}

/** The caller's IP as Vercel reports it (first x-forwarded-for entry). */
export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
