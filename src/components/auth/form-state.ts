"use client";

import { useState } from "react";
import type { z } from "zod";

import { toFieldErrors } from "@/lib/validation/common";

/**
 * Minimal form state for the auth screens: field errors from the shared Zod
 * schema, one form-level message, and a pending flag while a request runs.
 */
export function useAuthForm<S extends z.ZodType>(schema: S) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /** Validates the form's values; on failure shows the field errors and returns null. */
  function read(form: HTMLFormElement): z.output<S> | null {
    const result = schema.safeParse(Object.fromEntries(new FormData(form)));
    if (!result.success) {
      setFieldErrors(toFieldErrors(result.error));
      return null;
    }
    setFieldErrors({});
    setFormError(null);
    return result.data;
  }

  return { fieldErrors, formError, setFormError, pending, setPending, read };
}
