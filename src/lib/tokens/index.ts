import "server-only";

import { createHash, createHmac, randomBytes } from "node:crypto";

import { env } from "@/lib/env/server";

/** 32 random bytes as base64url: for links shown once (member invites, device tokens). */
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 hex digest. Only this is stored, so a database leak doesn't expose live links. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * A link token that can be rebuilt on demand (API Design, "Showing a link
 * again"): base64url(HMAC-SHA256(TOKEN_SECRET, kind:id:version)). Raising the
 * version gives a new token and retires the old one.
 */
export function deriveLinkToken(kind: "rsvp" | "gallery", id: string, version: number): string {
  return createHmac("sha256", env.TOKEN_SECRET)
    .update(`${kind}:${id}:${String(version)}`)
    .digest("base64url");
}
