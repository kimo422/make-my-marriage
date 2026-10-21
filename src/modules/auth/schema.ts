import { z } from "zod";

// Client-safe: shared by the auth forms and the /api/me handlers.

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Enter a valid email address"));

export const passwordField = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Use 128 characters or fewer");

export const nameField = z.string().trim().min(1, "Enter your name").max(80, "Keep it under 80");

export const signUpSchema = z.object({
  name: nameField,
  email: emailField,
  password: passwordField,
});

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password"),
});

export const forgotPasswordSchema = z.object({ email: emailField });

export const resetPasswordSchema = z
  .object({
    newPassword: passwordField,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

export const updateMeSchema = z.object({ name: nameField }).strict();

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
