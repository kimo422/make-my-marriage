import { z } from "zod";

import { objectId } from "@/lib/validation/common";

// Client-safe: shared by the event forms and handlers.

export const EVENT_TYPES = [
  "engagement",
  "haldi",
  "mehendi",
  "sangeet",
  "wedding",
  "reception",
  "custom",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  engagement: "Engagement",
  haldi: "Haldi",
  mehendi: "Mehendi",
  sangeet: "Sangeet",
  wedding: "Wedding",
  reception: "Reception",
  custom: "Custom",
};

const MAX_EVENT_MS = 7 * 86_400_000;

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(max).nullable().optional(),
  );

const mapUrl = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z
    .url({
      protocol: /^https$/,
      error: "Paste a full https:// link (for example from Google Maps)",
    })
    .max(500)
    .nullable()
    .optional(),
);

export const venueSchema = z
  .object({
    name: optionalText(120),
    address: optionalText(300),
    mapUrl,
  })
  .strict();

const instant = z.iso.datetime({ offset: true, error: "Enter a valid date and time" });

const eventFields = {
  name: z.string().trim().min(1, "Give the event a name").max(60, "Keep it under 60 characters"),
  type: z.enum(EVENT_TYPES, { error: "Choose a type" }),
  startAt: instant,
  endAt: instant,
  venue: venueSchema.optional(),
  dressCode: optionalText(120),
  notes: optionalText(1000),
  isPublic: z.boolean().optional(),
};

/** End after start, and no event longer than a week. */
export function checkTimes(startAt: string, endAt: string): string | null {
  const ms = new Date(endAt).getTime() - new Date(startAt).getTime();
  if (ms <= 0) return "End time must be after the start";
  if (ms > MAX_EVENT_MS) return "An event can last at most 7 days";
  return null;
}

export const createEventSchema = z
  .object(eventFields)
  .strict()
  .superRefine((v, ctx) => {
    const problem = checkTimes(v.startAt, v.endAt);
    if (problem) ctx.addIssue({ code: "custom", path: ["endAt"], message: problem });
  });

export const updateEventSchema = z
  .object({
    name: eventFields.name.optional(),
    type: eventFields.type.optional(),
    startAt: instant.optional(),
    endAt: instant.optional(),
    venue: eventFields.venue,
    dressCode: eventFields.dressCode,
    notes: eventFields.notes,
    isPublic: eventFields.isPublic,
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to change" });

export const reorderEventsSchema = z
  .object({ ids: z.array(objectId).min(1).max(100) })
  .strict()
  .refine((v) => new Set(v.ids).size === v.ids.length, { message: "Each event can appear once" });

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
