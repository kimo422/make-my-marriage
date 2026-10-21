import { z } from "zod";

import { emailField } from "@/modules/auth/schema";

import { ROLES, SIDES } from "./permissions";

// Client-safe: shared by the members screens and handlers.

export const roleField = z.enum(ROLES, { error: "Choose a role" });
export const sideField = z.enum(SIDES, { error: "Choose a side" });

export const createInviteSchema = z
  .object({ email: emailField, role: roleField, side: sideField })
  .strict();

export const updateMemberSchema = z
  .object({ role: roleField.optional(), side: sideField.optional() })
  .strict()
  .refine((v) => v.role !== undefined || v.side !== undefined, {
    message: "Change the role or the side",
  });

export const acceptInviteSchema = z.object({ token: z.string().min(20).max(200) }).strict();

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
