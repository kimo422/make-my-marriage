import { z } from "zod";

// Server environment. Kept free of `server-only` so next.config.ts can import it
// and fail the build when a value is missing. Later phases add their own
// variables here (R2, link tokens, cron).
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url(),
  MONGODB_URI: z.string().startsWith("mongodb", "must be a mongodb:// or mongodb+srv:// URI"),
  MONGODB_DB: z.string().min(1).default("mmm"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  // Signs session cookies and tokens. Generate with `openssl rand -base64 32`;
  // changing it signs everyone out.
  BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),

  // Optional so the app runs without email; while it's missing, development
  // logs password-reset links instead of sending them. Without a verified
  // domain, Resend only delivers to the account owner's own address.
  RESEND_API_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().startsWith("re_").optional(),
  ),
  EMAIL_FROM: z.string().min(3).default("Make My Marriage <onboarding@resend.dev>"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
