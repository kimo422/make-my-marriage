"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ArchCard } from "@/components/ui/card";
import { Field, inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";

const TRADITIONS = [
  "Telugu",
  "Tamil",
  "Punjabi",
  "Marathi",
  "Bengali",
  "Gujarati",
  "Malayali",
  "Other",
] as const;

function slugify(...parts: string[]): string {
  return parts
    .map((p) => p.trim().split(/\s+/)[0] ?? "")
    .filter(Boolean)
    .join("-and-")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "")
    .slice(0, 60);
}

// UI only: Phase 2 posts this to POST /api/weddings and checks the slug.
export function CreateWeddingForm({ siteHost }: { siteHost: string }) {
  const [bride, setBride] = useState("");
  const [groom, setGroom] = useState("");
  const [tradition, setTradition] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  const effectiveSlug = slugEdited ? slug : slugify(bride, groom);

  return (
    <form noValidate>
      <ArchCard className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Bride's name"
            name="brideName"
            autoComplete="off"
            placeholder="Ananya Rao"
            value={bride}
            onChange={(e) => {
              setBride(e.target.value);
            }}
          />
          <Field
            label="Groom's name"
            name="groomName"
            autoComplete="off"
            placeholder="Rohan Mehta"
            value={groom}
            onChange={(e) => {
              setGroom(e.target.value);
            }}
          />
        </div>

        <Field
          label="Main wedding date"
          name="primaryDate"
          type="date"
          hint="This drives your countdown."
        />

        <Field label="City" name="city" autoComplete="address-level2" placeholder="Hyderabad" />

        <fieldset>
          <legend className="text-sm font-semibold">Tradition (optional)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {TRADITIONS.map((t) => {
              const selected = tradition === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setTradition(selected ? null : t);
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
              value={effectiveSlug}
              placeholder="ananya-and-rohan"
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ""));
              }}
              className={cn(inputClass, "rounded-none border-0 focus:ring-0")}
            />
          </div>
          <p className="text-ink-muted text-sm">
            Your wedding website. Letters, numbers and hyphens only.
          </p>
        </div>

        <div className="space-y-1.5">
          <span className="text-sm font-semibold">Cover photo (optional)</span>
          <label className="rounded-card border-hairline bg-field hover:bg-stone/60 flex cursor-pointer flex-col items-center gap-2 border-2 border-dashed px-4 py-8 text-center">
            <span className="border-hairline text-ink-muted flex size-11 items-center justify-center rounded-full border bg-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="16"
                  rx="2.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <circle cx="9" cy="10" r="1.75" stroke="currentColor" strokeWidth="1.5" />
                <path d="m4 18 5-5 4 4 3-3 4 4" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
            <span>
              <span className="font-medium">Add a photo</span>
              <span className="text-ink-muted"> · JPG, PNG or HEIC</span>
            </span>
            <input type="file" name="cover" accept="image/jpeg,image/png,image/heic" hidden />
          </label>
        </div>
      </ArchCard>

      <Button className="mt-6">Create wedding →</Button>
      <p className="text-ink-muted mt-3 text-center">
        You&apos;ll be the owner. Invite parents and family next.
      </p>
    </form>
  );
}
