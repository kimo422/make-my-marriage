import type { SelectHTMLAttributes } from "react";

import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: readonly { value: string; label: string }[];
  error?: string | undefined;
  /** Visually hide the label (it's still read by screen readers). */
  hideLabel?: boolean;
}

export function SelectField({
  label,
  options,
  error,
  hideLabel = false,
  id,
  className,
  ...select
}: SelectFieldProps) {
  const selectId = id ?? select.name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={selectId} className={hideLabel ? "sr-only" : "text-sm font-semibold"}>
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={cn(inputClass, "appearance-none bg-[length:16px] pr-10", className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235b5560' stroke-width='1.75'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 14px center",
        }}
        {...select}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? <p className="text-danger text-sm">{error}</p> : null}
    </div>
  );
}
