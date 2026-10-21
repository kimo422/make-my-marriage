import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

export const inputClass =
  "h-12 w-full rounded-field border border-hairline bg-field px-4 text-ink placeholder:text-ink-muted/70 focus:border-emerald focus:ring-2 focus:ring-emerald/15 focus:outline-none aria-invalid:border-danger/60";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  /** Validation message; replaces the hint and marks the input invalid. */
  error?: string | undefined;
  /** Shown at the right of the label row, e.g. a "Forgot password?" link. */
  aside?: ReactNode;
  /** Icon or control drawn inside the input on the right. */
  trailing?: ReactNode;
}

export function Field({
  label,
  hint,
  error,
  aside,
  trailing,
  id,
  className,
  ...input
}: FieldProps) {
  const inputId = id ?? input.name;
  const noteId = error || hint ? `${String(inputId)}-note` : undefined;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-semibold">
          {label}
        </label>
        {aside}
      </div>
      <div className="relative">
        <input
          id={inputId}
          aria-describedby={noteId}
          aria-invalid={error ? true : undefined}
          className={cn(inputClass, trailing ? "pr-12" : undefined, className)}
          {...input}
        />
        {trailing ? (
          <div className="text-ink-muted absolute inset-y-0 right-3 flex items-center">
            {trailing}
          </div>
        ) : null}
      </div>
      {error ? (
        <p id={noteId} className="text-danger text-sm">
          {error}
        </p>
      ) : hint ? (
        <p id={noteId} className="text-ink-muted text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
