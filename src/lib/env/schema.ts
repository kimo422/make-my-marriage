import { z } from "zod";

// Server environment. Kept free of `server-only` so next.config.ts can import it
// and fail the build when a value is missing. Each later phase adds its own
// variables here (Better Auth, Resend, R2, tokens, cron).
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url(),
  MONGODB_URI: z.string().startsWith("mongodb", "must be a mongodb:// or mongodb+srv:// URI"),
  MONGODB_DB: z.string().min(1).default("mmm"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
