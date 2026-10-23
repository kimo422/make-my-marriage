import "server-only";

import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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

/**
 * A salted scrypt hash for short shared secrets typed by guests (the website
 * password, later the gallery PIN): "scrypt:<salt>:<hash>", both base64url.
 */
export function hashSecret(secret: string): string {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString("base64url")}:${scryptSync(secret, salt, 32).toString("base64url")}`;
}

export function verifySecret(secret: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = scryptSync(secret, Buffer.from(salt, "base64url"), expected.length);
  return timingSafeEqual(actual, expected);
}

/** HMAC-SHA256 under TOKEN_SECRET, for short-lived signed cookies. */
export function signValue(value: string): string {
  return createHmac("sha256", env.TOKEN_SECRET).update(value).digest("base64url");
}

/** Constant-time comparison of two signatures. */
export function sameSignature(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
