// Browser-side JSON client for the app's own API. Client-safe.

import type { ApiError } from "@/lib/types/api";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;
  readonly details: unknown;

  constructor(status: number, body: ApiError["error"] | undefined) {
    super(body?.message ?? "Something went wrong. Please try again.");
    this.status = status;
    this.code = body?.code ?? "INTERNAL";
    this.fields = body?.fields ?? {};
    this.details = body?.details;
  }
}

/** Sends a request and returns `data`, or throws ApiClientError with the API's code and fields. */
export async function api<T = unknown>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  options: { ifMatch?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  // Optimistic concurrency: a stale copy gets 409 CONFLICT instead of overwriting.
  if (options.ifMatch) headers["if-match"] = options.ifMatch;
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError(0, {
      code: "INTERNAL",
      message: "Couldn't reach the server. Check your connection and try again.",
    });
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as { data?: T } & Partial<ApiError>;
  if (!res.ok) throw new ApiClientError(res.status, json.error);
  return json.data as T;
}
