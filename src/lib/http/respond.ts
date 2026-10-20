import type { ApiData, ApiList } from "@/lib/types/api";

// Success responses in the API's envelope: { data } or { data, page }.

export function ok(data: unknown, init?: ResponseInit): Response {
  return Response.json({ data } satisfies ApiData<unknown>, init);
}

export function created(data: unknown): Response {
  return ok(data, { status: 201 });
}

export function list(data: unknown[], nextCursor: string | null = null): Response {
  return Response.json({ data, page: { nextCursor } } satisfies ApiList<unknown>);
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}
