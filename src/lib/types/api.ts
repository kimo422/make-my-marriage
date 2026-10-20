import type { ErrorCode, FieldErrors } from "@/lib/errors";

// Response envelopes shared by route handlers and the client fetch wrapper.

export interface ApiData<T> {
  data: T;
}

export interface ApiList<T> {
  data: T[];
  page: { nextCursor: string | null };
}

export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    fields?: FieldErrors;
    requestId?: string;
    details?: unknown;
  };
}
