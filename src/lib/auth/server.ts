import "server-only";

import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import type { Db, MongoClient } from "mongodb";

import { connectDb } from "@/lib/db/connect";
import { sendEmail } from "@/lib/email/send";
import { passwordResetEmail } from "@/lib/email/templates";
import { env } from "@/lib/env/server";
import { allowedOrigins } from "@/lib/http/origins";

const DAY = 60 * 60 * 24;

function createAuth(db: Db, client: MongoClient) {
  return betterAuth({
    appName: "Make My Marriage",
    baseURL: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: allowedOrigins(),
    // Shares mongoose's client, so each function instance keeps one small pool.
    // Collections keep Better Auth's names: user, session, account, verification.
    database: mongodbAdapter(db, { client }),

    emailAndPassword: {
      enabled: true,
      // Off by decision: a new account can sign in straight away. Turning this
      // on later is one flag plus a verification email.
      requireEmailVerification: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({ to: user.email, ...passwordResetEmail({ name: user.name, url }) });
      },
    },

    session: {
      expiresIn: 30 * DAY,
      updateAge: DAY,
    },

    // DELETE /api/me calls this after refusing sole owners (see modules/auth/service.ts).
    user: { deleteUser: { enabled: true } },

    // Defaults to production only. Counters live in MongoDB so every function
    // instance sees the same totals (collection: rateLimit).
    rateLimit: {
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 15 * 60, max: 10 },
        "/sign-up/email": { window: 60 * 60, max: 10 },
        "/request-password-reset": { window: 60 * 60, max: 3 },
      },
    },

    advanced: {
      ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as typeof globalThis & { __auth?: Promise<Auth> };

/**
 * The Better Auth instance, created once MongoDB is connected and then reused
 * by warm invocations and hot reloads.
 */
export function getAuth(): Promise<Auth> {
  globalForAuth.__auth ??= connectDb()
    .then(({ connection }) => {
      if (!connection.db) throw new Error("MongoDB connection has no database handle");
      return createAuth(connection.db, connection.getClient());
    })
    .catch((error: unknown) => {
      globalForAuth.__auth = undefined;
      throw error;
    });
  return globalForAuth.__auth;
}
