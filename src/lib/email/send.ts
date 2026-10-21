import "server-only";

import { Resend } from "resend";

import { env } from "@/lib/env/server";
import { logger } from "@/lib/logger";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let client: Resend | undefined;

/**
 * Sends one transactional email through Resend, retrying once on failure.
 *
 * Without RESEND_API_KEY the message is not sent: development logs it so the
 * flow can be tested locally; other environments log an error. Throws only
 * when Resend rejects both attempts.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (!env.RESEND_API_KEY) {
    if (env.NODE_ENV === "production") {
      logger.error({ subject: message.subject }, "email not sent: RESEND_API_KEY is not set");
    } else {
      // Development only: printing the body lets you follow reset links locally.
      logger.warn({ subject: message.subject, text: message.text }, "email not sent (dev)");
    }
    return;
  }

  client ??= new Resend(env.RESEND_API_KEY);
  const payload = { from: env.EMAIL_FROM, ...message };

  let { error } = await client.emails.send(payload);
  if (error) ({ error } = await client.emails.send(payload));
  if (error) {
    logger.error({ subject: message.subject, err: error.message }, "email failed");
    throw new Error(`Resend rejected the email: ${error.message}`);
  }
}
