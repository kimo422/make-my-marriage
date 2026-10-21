import "server-only";

import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes as base64url: for links shown once (member invites, device tokens). */
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 hex digest. Only this is stored, so a database leak doesn't expose live links. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
