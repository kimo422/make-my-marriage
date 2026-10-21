import "server-only";

import type { NextRequest } from "next/server";
import type { z } from "zod";

import { AppError } from "@/lib/errors";
import { stripOperatorKeys, toFieldErrors } from "@/lib/validation/common";

const MAX_JSON_BYTES = 100 * 1024;

function validate<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError("VALIDATION_FAILED", "Some fields are invalid", {
      fields: toFieldErrors(result.error),
    });
  }
  return result.data;
}

/** Reads, size-checks, sanitises and validates a JSON body. */
export async function parseJson<S extends z.ZodType>(
  request: NextRequest,
  schema: S,
): Promise<z.output<S>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new AppError("UNSUPPORTED_MEDIA_TYPE", "Send the body as application/json");
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_JSON_BYTES) {
    throw new AppError("PAYLOAD_TOO_LARGE", "Request body is too large");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) {
    throw new AppError("PAYLOAD_TOO_LARGE", "Request body is too large");
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AppError("BAD_REQUEST", "Body is not valid JSON");
  }
  return validate(schema, stripOperatorKeys(json));
}

/** Validates query-string parameters; repeated keys keep the first value. */
export function parseQuery<S extends z.ZodType>(request: NextRequest, schema: S): z.output<S> {
  const query: Record<string, string> = {};
  for (const [key, value] of request.nextUrl.searchParams) {
    query[key] ??= value;
  }
  return validate(schema, stripOperatorKeys(query));
}

/**
 * Validates path params. A malformed id is reported as 404, like a missing
 * record, so ids and tokens can't be probed by their shape.
 */
export function parseParams<S extends z.ZodType>(params: unknown, schema: S): z.output<S> {
  const result = schema.safeParse(params);
  if (!result.success) throw new AppError("NOT_FOUND", "Not found");
  return result.data;
}

/**
 * Optimistic concurrency (API Design, "Concurrency"): clients send the
 * record's `updatedAt` as `If-Match`, and a stale value gets 409 CONFLICT.
 * Returns undefined when the header is absent, so the check is opt-in.
 */
export function readIfMatch(request: NextRequest): Date | undefined {
  const raw = request.headers.get("if-match");
  if (!raw) return undefined;
  const at = new Date(raw.replace(/^W\//, "").replace(/"/g, ""));
  if (Number.isNaN(at.getTime())) {
    throw new AppError("BAD_REQUEST", "If-Match must be the record's updatedAt timestamp");
  }
  return at;
}
