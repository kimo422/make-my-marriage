import "server-only";

import { unstable_rethrow } from "next/navigation";
import type { NextRequest } from "next/server";
import { ZodError } from "zod";

import { env } from "@/lib/env/server";
import { AppError } from "@/lib/errors";
import { logger, type Logger } from "@/lib/logger";
import type { ApiError } from "@/lib/types/api";
import { toFieldErrors } from "@/lib/validation/common";

export interface HandlerContext<P> {
  params: P;
  requestId: string;
  log: Logger;
}

type Handler<P> = (request: NextRequest, context: HandlerContext<P>) => Promise<Response>;

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// The app's own origins: APP_URL, plus the per-deployment URLs Vercel sets on
// previews so pull-request builds can make mutations against themselves.
function allowedOrigins(): Set<string> {
  const origins = new Set([new URL(env.APP_URL).origin]);
  for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) {
    if (host) origins.add(`https://${host}`);
  }
  return origins;
}

/**
 * Wraps a route handler with the cross-cutting rules every API route follows:
 * request id, Origin check on mutations (CSRF), no-store caching and the
 * standard error body. Handlers throw AppError for expected failures.
 */
export function route<P extends Record<string, string | string[]> = Record<string, never>>(
  handler: Handler<P>,
) {
  return async (request: NextRequest, context: { params: Promise<P> }): Promise<Response> => {
    // Reading the request here, outside the try block, is what keeps API routes
    // from being prerendered under Cache Components: Next.js stops prerendering
    // at the first request access, and that signal must not be caught below.
    const requestId = crypto.randomUUID();
    const log = logger.child({ requestId, method: request.method, path: request.nextUrl.pathname });

    let response: Response;
    try {
      if (MUTATING_METHODS.has(request.method)) {
        const origin = request.headers.get("origin");
        if (!origin || !allowedOrigins().has(origin)) {
          throw new AppError("FORBIDDEN", "Cross-origin request blocked");
        }
      }
      response = await handler(request, { params: await context.params, requestId, log });
    } catch (error) {
      unstable_rethrow(error);
      response = errorResponse(error, requestId, log);
    }

    response.headers.set("X-Request-Id", requestId);
    if (!response.headers.has("Cache-Control")) {
      response.headers.set("Cache-Control", "private, no-store");
    }
    return response;
  };
}

export function errorResponse(error: unknown, requestId: string, log: Logger): Response {
  if (error instanceof AppError) {
    const body: ApiError = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.fields && { fields: error.fields }),
        ...(error.details !== undefined && { details: error.details }),
      },
    };
    if (error.status >= 500) log.error({ err: error }, "request failed");
    return Response.json(body, { status: error.status, headers: error.headers });
  }

  if (error instanceof ZodError) {
    const body: ApiError = {
      error: {
        code: "VALIDATION_FAILED",
        message: "Some fields are invalid",
        fields: toFieldErrors(error),
      },
    };
    return Response.json(body, { status: 422 });
  }

  log.error({ err: error }, "unhandled error");
  const body: ApiError = {
    error: { code: "INTERNAL", message: "Something went wrong", requestId },
  };
  return Response.json(body, { status: 500 });
}
