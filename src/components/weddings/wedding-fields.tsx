"use client";

import { useEffect, useState } from "react";

import { inputClass } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { SLUG_PATTERN } from "@/modules/weddings/schema";
import type { SlugAvailabilityDto } from "@/modules/weddings/types";

export const TRADITIONS = [
  "Telugu",
  "Tamil",
  "Punjabi",
  "Marathi",
  "Bengali",
  "Gujarati",
  "Malayali",
  "Other",
] as const;

/** "Santhvana Rao" + "Balaram K" → "santhvana-and-balaram". */
export function slugify(...names: string[]): string {
  return names
    .map((n) => (n.trim().split(/\s+/)[0] ?? "").toLowerCase().replace(/[^a-z0-9]+/g, ""))
    .filter(Boolean)
    .join("-and-")
    .slice(0, 60);
}

export function TraditionPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">Tradition (optional)</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {TRADITIONS.map((t) => {
          const selected = value === t;
          return (
            <button
              key={t}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                onChange(selected ? null : t);
              }}
              className={cn(
                "h-10 rounded-full border px-4 transition",
                selected
                  ? "border-blush bg-blush text-ink"
                  : "border-hairline bg-field text-ink-muted hover:bg-stone",
              )}
            >
              {t}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";

/**
 * Website address with a live availability check. `currentSlug` is the
 * wedding's own address in settings, which is never reported as taken.
 */
export function SlugField({
  value,
  onChange,
  siteHost,
  error,
  currentSlug,
}: {
  value: string;
  onChange: (value: string) => void;
  siteHost: string;
  error?: string | undefined;
  currentSlug?: string;
}) {
  // The server's answer for the most recently checked slug. Everything else is
  // derived during render, so the effect only does the (debounced) network call.
  const [result, setResult] = useState<SlugAvailabilityDto | null>(null);

  const unchanged = !value || value === currentSlug;
  const wellFormed = value.length >= 3 && SLUG_PATTERN.test(value) && !value.includes("--");
  const needsCheck = !unchanged && wellFormed;

  let status: SlugStatus;
  if (unchanged) status = "idle";
  else if (!wellFormed) status = "invalid";
  else if (result?.slug === value) status = result.available ? "available" : "taken";
  else status = "checking";

  useEffect(() => {
    if (!needsCheck) return;
    const timer = setTimeout(() => {
      api<SlugAvailabilityDto>(
        "GET",
        `/api/weddings/slug-availability?slug=${encodeURIComponent(value)}`,
      )
        .then(setResult)
        .catch(() => {
          // Offline or a hiccup: let the create/save request give the verdict.
          setResult({ slug: value, available: true });
        });
    }, 400);
    return () => {
      clearTimeout(timer);
    };
  }, [needsCheck, value]);

  const message =
    error ??
    {
      idle: "Your wedding website. Letters, numbers and hyphens only.",
      checking: "Checking…",
      available: "Available",
      taken: "That address is taken. Try another.",
      invalid: "Use 3–60 lowercase letters, numbers and single hyphens.",
    }[status];
  const tone =
    error || status === "taken" || status === "invalid"
      ? "text-danger"
      : status === "available"
        ? "text-emerald"
        : "text-ink-muted";

  return (
    <div className="space-y-1.5">
      <label htmlFor="slug" className="text-sm font-semibold">
        Website address
      </label>
      <div className="rounded-field border-hairline focus-within:border-emerald focus-within:ring-emerald/15 flex overflow-hidden border focus-within:ring-2">
        <span className="bg-stone text-ink-muted flex items-center px-3 text-sm whitespace-nowrap">
          <span className="hidden sm:inline">{siteHost}</span>/site/
        </span>
        <input
          id="slug"
          name="slug"
          value={value}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="santhvana-and-balaram"
          aria-describedby="slug-note"
          aria-invalid={error || status === "taken" || status === "invalid" ? true : undefined}
          onChange={(e) => {
            onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ""));
          }}
          className={cn(inputClass, "min-w-0 rounded-none border-0 focus:ring-0")}
        />
      </div>
      <p id="slug-note" className={cn("text-sm", tone)} aria-live="polite">
        {status === "available" && !error ? "✓ " : ""}
        {message}
      </p>
    </div>
  );
}
