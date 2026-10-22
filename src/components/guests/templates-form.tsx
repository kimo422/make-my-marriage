"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ArchCard } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/form-alert";
import { api, ApiClientError } from "@/lib/api-client";
import { TEMPLATE_PLACEHOLDERS, type Templates } from "@/modules/guests/schema";

const SECTIONS: { key: keyof Templates; title: string; hint: string }[] = [
  { key: "invite", title: "Invitation", hint: "The first message, with the family's RSVP link." },
  { key: "reminder", title: "Reminder", hint: "For families who haven't answered yet." },
  { key: "eventDay", title: "On the day", hint: "Directions and timing on the event day." },
];

interface Props {
  weddingId: string;
  templates: Templates;
  defaults: Templates;
  /** Sample values for the preview. */
  sample: Record<string, string>;
}

function render(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export function TemplatesForm({ weddingId, templates, defaults, sample }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Templates>(templates);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setStatus("saving");
    setError(null);
    setFieldErrors({});
    try {
      await api("PUT", `/api/weddings/${weddingId}/message-templates`, values);
      setStatus("saved");
      router.refresh();
    } catch (e) {
      if (e instanceof ApiClientError) setFieldErrors(e.fields);
      setError(e instanceof Error ? e.message : "Couldn't save the wording.");
      setStatus("idle");
    }
  }

  return (
    <div className="space-y-5">
      {error ? <FormAlert>{error}</FormAlert> : null}
      {status === "saved" ? (
        <FormAlert tone="success">Saved. New messages use this wording.</FormAlert>
      ) : null}
      <p className="text-ink-muted text-sm">
        Words in curly brackets are filled in for each family:{" "}
        {TEMPLATE_PLACEHOLDERS.map((p) => (
          <code key={p} className="bg-stone mx-0.5 rounded px-1.5 py-0.5 text-xs">
            {`{${p}}`}
          </code>
        ))}
      </p>
      {SECTIONS.map(({ key, title, hint }) => (
        <ArchCard key={key} className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <label htmlFor={`tpl-${key}`} className="font-serif text-xl">
                {title}
              </label>
              <p className="text-ink-muted text-sm">{hint}</p>
            </div>
            {values[key] !== defaults[key] ? (
              <button
                type="button"
                className="text-emerald shrink-0 text-sm font-medium"
                onClick={() => {
                  setValues((v) => ({ ...v, [key]: defaults[key] }));
                  setStatus("idle");
                }}
              >
                Use the original
              </button>
            ) : null}
          </div>
          <textarea
            id={`tpl-${key}`}
            rows={8}
            value={values[key]}
            maxLength={1000}
            aria-invalid={fieldErrors[key] ? true : undefined}
            className="border-hairline bg-field rounded-field focus:border-emerald focus:ring-emerald/15 w-full border px-4 py-3 font-mono text-sm focus:ring-2 focus:outline-none"
            onChange={(e) => {
              setValues((v) => ({ ...v, [key]: e.target.value }));
              setStatus("idle");
            }}
          />
          {fieldErrors[key] ? <p className="text-danger text-sm">{fieldErrors[key]}</p> : null}
          <details>
            <summary className="text-emerald cursor-pointer text-sm font-medium">Preview</summary>
            <p className="bg-emerald-soft mt-2 rounded-xl p-4 text-sm whitespace-pre-line">
              {render(values[key], sample)}
            </p>
          </details>
        </ArchCard>
      ))}
      <Button
        className="sm:w-auto"
        disabled={status === "saving"}
        onClick={() => {
          void save();
        }}
      >
        {status === "saving" ? "Saving…" : "Save wording"}
      </Button>
    </div>
  );
}
