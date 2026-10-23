import { z } from "zod";

import { isDateOnly } from "@/lib/dates";

// Client-safe: shared by the wedding forms and handlers.

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters")
  .max(60, "Use 60 characters or fewer")
  .regex(SLUG_PATTERN, "Use lowercase letters, numbers and hyphens, not at the start or end")
  .refine((s) => !s.includes("--"), "Avoid double hyphens");

export const dateOnlyField = z.string().refine(isDateOnly, "Enter a valid date");

const personName = (label: string) =>
  z.string().trim().min(1, `Enter the ${label}'s name`).max(60, "Keep it under 60 characters");

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional(),
  );

export const createWeddingSchema = z
  .object({
    brideName: personName("bride"),
    groomName: personName("groom"),
    primaryDate: dateOnlyField,
    city: z.string().trim().min(1, "Enter the city").max(80),
    tradition: optionalText(40),
    slug: slugField,
  })
  .strict();

export const updateWeddingSchema = z
  .object({
    brideName: personName("bride").optional(),
    groomName: personName("groom").optional(),
    primaryDate: dateOnlyField.optional(),
    city: z.string().trim().min(1, "Enter the city").max(80).optional(),
    tradition: z.string().trim().max(40).nullable().optional(),
    rsvpDeadline: dateOnlyField.nullable().optional(),
    slug: slugField.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to change" });

/** Deleting a wedding asks the owner to type its slug, like GitHub does for repos. */
export const deleteWeddingSchema = z.object({ slug: z.string().trim().toLowerCase() }).strict();

export const slugQuerySchema = z.object({ slug: z.string().max(80) });

/**
 * Website settings (FR-8.1–8.4). `password` sets a new one; null removes it.
 * A blank story clears it.
 */
export const websiteSettingsSchema = z
  .object({
    published: z.boolean().optional(),
    story: z.string().trim().max(2000, "Keep the story under 2,000 characters").optional(),
    password: z
      .string()
      .min(6, "Use at least 6 characters")
      .max(100, "Use 100 characters or fewer")
      .nullable()
      .optional(),
    indexable: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to change" });

export const siteUnlockSchema = z
  .object({ password: z.string().min(1, "Enter the password").max(100) })
  .strict();

export type CreateWeddingInput = z.infer<typeof createWeddingSchema>;
export type UpdateWeddingInput = z.infer<typeof updateWeddingSchema>;
export type WebsiteSettingsInput = z.infer<typeof websiteSettingsSchema>;
