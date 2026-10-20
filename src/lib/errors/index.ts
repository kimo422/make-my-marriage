// Stable error codes from the API Design. `code` is for clients to switch on;
// `message` is for people.
export const errorStatus = {
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  UPLOADS_CLOSED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SLUG_TAKEN: 409,
  SOLE_OWNER: 409,
  LAST_OWNER: 409,
  RSVP_CLOSED: 409,
  PAYLOAD_TOO_LARGE: 413,
  QUOTA_EXCEEDED: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  VALIDATION_FAILED: 422,
  RSVP_OVER_CAPACITY: 422,
  EVENT_NOT_INVITED: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof errorStatus;

export type FieldErrors = Record<string, string>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields: FieldErrors | undefined;
  /** Extra body data, such as the current record on a 409 CONFLICT. */
  readonly details: unknown;
  /** Response headers, such as Retry-After on RATE_LIMITED. */
  readonly headers: Record<string, string> | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    options: { fields?: FieldErrors; details?: unknown; headers?: Record<string, string> } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = errorStatus[code];
    this.fields = options.fields;
    this.details = options.details;
    this.headers = options.headers;
  }
}

export const notFound = (message = "Not found") => new AppError("NOT_FOUND", message);
export const forbidden = (message = "You don't have access to do that") =>
  new AppError("FORBIDDEN", message);
export const unauthenticated = (message = "Please sign in") =>
  new AppError("UNAUTHENTICATED", message);
