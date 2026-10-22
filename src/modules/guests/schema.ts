import { z } from "zod";

import { normalizePhone } from "@/lib/phone";
import { objectId } from "@/lib/validation/common";

// Client-safe: shared by the guest, RSVP and invite screens and handlers.

export const HOUSEHOLD_SIDES = ["bride", "groom"] as const;
export type HouseholdSide = (typeof HOUSEHOLD_SIDES)[number];
export const HOUSEHOLD_SIDE_LABELS: Record<HouseholdSide, string> = {
  bride: "Bride's side",
  groom: "Groom's side",
};

export const MESSAGE_STATES = ["not_sent", "sent", "opened", "responded"] as const;
export type MessageState = (typeof MESSAGE_STATES)[number];
export const MESSAGE_STATE_LABELS: Record<MessageState, string> = {
  not_sent: "Not sent",
  sent: "Sent",
  opened: "Opened",
  responded: "Responded",
};

export const MESSAGE_KINDS = ["invite", "reminder", "event_day"] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export const MAX_HEADCOUNT = 20;

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const phoneField = z.preprocess(
  blankToNull,
  z
    .string()
    .nullable()
    .optional()
    .transform((v, ctx) => {
      if (v === null || v === undefined) return v;
      const e164 = normalizePhone(v);
      if (!e164) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a valid phone number, with the country code if it isn't Indian",
        });
        return z.NEVER;
      }
      return e164;
    }),
);

const emailField = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email("Enter a valid email address"))
    .nullable()
    .optional(),
);

const optionalText = (max: number) =>
  z.preprocess(blankToNull, z.string().trim().max(max).nullable().optional());

export const guestSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the guest's name").max(80, "Keep it under 80 characters"),
    phone: phoneField,
    email: emailField,
    relation: optionalText(80),
    isChild: z.boolean().optional(),
  })
  .strict();

const headcount = z.coerce
  .number()
  .int()
  .min(1, "At least 1")
  .max(MAX_HEADCOUNT, `At most ${String(MAX_HEADCOUNT)}`);
const eventIds = z
  .array(objectId)
  .max(50)
  .refine((ids) => new Set(ids).size === ids.length, { message: "Each event can appear once" });

const householdFields = {
  name: z.string().trim().min(1, 'Give the household a name, for example "Sharma family"').max(80),
  side: z.enum(HOUSEHOLD_SIDES, { error: "Choose the bride's or groom's side" }),
  group: optionalText(60),
  maxHeadcount: headcount.optional(),
  invitedEventIds: eventIds.optional(),
  notes: optionalText(1000),
};

export const createHouseholdSchema = z
  .object({
    ...householdFields,
    guests: z.array(guestSchema).min(1, "Add at least one guest").max(MAX_HEADCOUNT),
  })
  .strict();

export const updateHouseholdSchema = z
  .object({
    name: householdFields.name.optional(),
    side: householdFields.side.optional(),
    group: householdFields.group,
    maxHeadcount: householdFields.maxHeadcount,
    invitedEventIds: householdFields.invitedEventIds,
    notes: householdFields.notes,
    primaryGuestId: objectId.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to change" });

export const updateGuestSchema = z
  .object({
    name: guestSchema.shape.name.optional(),
    phone: phoneField,
    email: emailField,
    relation: optionalText(80),
    isChild: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to change" });

/** The whole list comes back at once: a wedding has hundreds of households, not millions. */
export const householdQuerySchema = z.object({
  side: z.enum(HOUSEHOLD_SIDES).optional(),
  group: z.string().max(60).optional(),
  messageState: z.enum(MESSAGE_STATES).optional(),
  eventId: objectId.optional(),
  rsvp: z.enum(["pending"]).optional(),
  q: z.string().trim().max(80).optional(),
});

export const rsvpAnswerSchema = z
  .object({
    eventId: objectId,
    attending: z.boolean(),
    headcount: z.number().int().min(0).max(MAX_HEADCOUNT),
  })
  .strict();

/** The guest's RSVP form: answers for one or more events, saved together. */
export const submitRsvpSchema = z
  .object({ answers: z.array(rsvpAnswerSchema).min(1).max(12) })
  .strict()
  .refine((v) => new Set(v.answers.map((a) => a.eventId)).size === v.answers.length, {
    message: "Answer each event once",
  });

export const markSentSchema = z.object({ kind: z.enum(MESSAGE_KINDS) }).strict();

export const exportQuerySchema = z.object({ eventId: objectId.optional() });

export const inviteMessageQuerySchema = z.object({
  kind: z.enum(MESSAGE_KINDS).default("invite"),
  eventId: objectId.optional(),
});

export const TEMPLATE_PLACEHOLDERS = [
  "householdName",
  "coupleNames",
  "rsvpUrl",
  "rsvpDeadline",
  "eventName",
  "eventDay",
  "eventTime",
  "venue",
] as const;

const templateText = z
  .string()
  .trim()
  .min(1, "Write a message")
  .max(1000, "Keep it under 1,000 characters so WhatsApp opens it reliably");
export const templatesSchema = z
  .object({ invite: templateText, reminder: templateText, eventDay: templateText })
  .strict();

/** One row of a guest CSV after parsing and normalising (see csv-import.ts). */
export const importRowSchema = z
  .object({
    line: z.number().int().min(2),
    household: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(80),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    side: z.enum(HOUSEHOLD_SIDES),
    relation: z.string().max(80).nullable(),
    group: z.string().max(60).nullable(),
    maxHeadcount: z.number().int().min(1).max(MAX_HEADCOUNT).nullable(),
    isChild: z.boolean(),
    notes: z.string().max(1000).nullable(),
  })
  .strict();

export const importCommitSchema = z
  .object({ rows: z.array(importRowSchema).min(1).max(2000), eventIds: eventIds.default([]) })
  .strict();

export type GuestInput = z.infer<typeof guestSchema>;
export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
export type UpdateHouseholdInput = z.infer<typeof updateHouseholdSchema>;
export type UpdateGuestInput = z.infer<typeof updateGuestSchema>;
export type HouseholdQuery = z.infer<typeof householdQuerySchema>;
export type RsvpAnswer = z.infer<typeof rsvpAnswerSchema>;
export type ImportRow = z.infer<typeof importRowSchema>;
export type Templates = z.infer<typeof templatesSchema>;
