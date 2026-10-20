import { z } from "zod";

// Client-safe building blocks shared by every module's schema.ts.

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const cursorQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(40),
  cursor: objectId.optional(),
});

/**
 * Removes keys that start with `$` or contain `.` at any depth, so user input
 * can never smuggle a MongoDB operator into a query or update.
 */
export function stripOperatorKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripOperatorKeys);
  if (value !== null && typeof value === "object") {
    const clean: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      if (key.startsWith("$") || key.includes(".")) continue;
      clean[key] = stripOperatorKeys(inner);
    }
    return clean;
  }
  return value;
}

/** Flattens Zod issues into the API's `fields` map: { "guests.0.phone": "..." }. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "_";
    fields[key] ??= issue.message;
  }
  return fields;
}
