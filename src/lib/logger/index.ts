import "server-only";

import pino from "pino";

import { env } from "@/lib/env/server";

// Structured JSON logs for Vercel's runtime log viewer. Guest contact details,
// tokens and credentials must never reach a log line, so the common carriers
// are redacted even if someone logs a whole object by mistake.
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "make-my-marriage" },
  redact: {
    paths: [
      "password",
      "*.password",
      "token",
      "*.token",
      "phone",
      "*.phone",
      "email",
      "*.email",
      "headers.authorization",
      "headers.cookie",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[redacted]",
  },
});

export type Logger = typeof logger;
