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

  // Derives guests' personal RSVP (and, later, gallery) links so they can be
  // shown again for WhatsApp. Anyone holding it can rebuild every link;
  // changing it breaks all links already sent.
  TOKEN_SECRET: z.string().min(32, "must be at least 32 characters"),

  // Optional so the app runs without email; while it's missing, development
  // logs password-reset links instead of sending them. Without a verified
  // domain, Resend only delivers to the account owner's own address.
  RESEND_API_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().startsWith("re_").optional(),
  ),
  EMAIL_FROM: z.string().min(3).default("Make My Marriage <onboarding@resend.dev>"),

  // Set by Vercel: "production", "preview" or "development".
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Production must point at its real https address: APP_URL builds every RSVP
 * link and is the only origin allowed to sign in, so a localhost value would
 * ship broken links and a site nobody can log into.
 */
const productionEnvSchema = serverEnvSchema.superRefine((env, ctx) => {
  if (env.VERCEL_ENV !== "production") return;
  const url = new URL(env.APP_URL);
  if (url.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(url.hostname)) {
    ctx.addIssue({
      code: "custom",
      path: ["APP_URL"],
      message: "must be the site's public https address in production",
    });
  }
});

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = productionEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
