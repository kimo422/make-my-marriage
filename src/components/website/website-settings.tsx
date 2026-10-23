"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ArchCard } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { FormAlert } from "@/components/ui/form-alert";
import { PasswordField } from "@/components/ui/password-field";
import { api, ApiClientError } from "@/lib/api-client";
import type { WebsiteSettingsDto } from "@/modules/weddings/types";

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block font-medium">{label}</span>
        <span className="text-ink-muted block text-sm">{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        className="accent-emerald mt-1 size-5 shrink-0"
        onChange={(e) => {
          onChange(e.target.checked);
        }}
      />
    </label>
  );
}

/** Publish the website, write the story, set a password and choose search indexing. */
export function WebsiteSettings({
  weddingId,
  settings,
}: {
  weddingId: string;
  settings: WebsiteSettingsDto;
}) {
  const router = useRouter();
  const [published, setPublished] = useState(settings.published);
  const [story, setStory] = useState(settings.story);
  const [indexable, setIndexable] = useState(settings.indexable);
  const [protectedSite, setProtectedSite] = useState(settings.passwordProtected);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const path = `/api/weddings/${weddingId}/website`;

  async function save(body: Record<string, unknown>, success: string) {
    setBusy(true);
    setMessage(null);
    setFieldErrors({});
    try {
      const next = await api<WebsiteSettingsDto>("PATCH", path, body);
      setProtectedSite(next.passwordProtected);
      setMessage({ tone: "success", text: success });
      router.refresh();
      return true;
    } catch (e) {
      if (e instanceof ApiClientError) setFieldErrors(e.fields);
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Couldn't save." });
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <ArchCard className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-serif text-2xl">Wedding website</h2>
        <Chip tone={settings.published ? "emerald" : "stone"}>
          {settings.published ? "Published" : "Not published"}
        </Chip>
      </div>
      {message ? <FormAlert tone={message.tone}>{message.text}</FormAlert> : null}

      <div className="bg-field border-hairline rounded-field flex flex-wrap items-center justify-between gap-3 border px-4 py-3">
        <span className="min-w-0 truncate text-sm">{settings.url}</span>
        <span className="flex gap-3 text-sm font-medium">
          <button
            type="button"
            className="text-emerald"
            onClick={() => {
              void navigator.clipboard.writeText(settings.url).then(() => {
                setMessage({ tone: "success", text: "Website link copied." });
              });
            }}
          >
            Copy
          </button>
          {settings.published ? (
            <a href={settings.url} target="_blank" rel="noreferrer" className="text-emerald">
              Open
            </a>
          ) : null}
        </span>
      </div>

      <Toggle
        label="Publish the website"
        hint="Until then, the link shows “not found” to everyone."
        checked={published}
        onChange={setPublished}
      />

      <div className="space-y-1.5">
        <label htmlFor="story" className="text-sm font-semibold">
          Our story
        </label>
        <textarea
          id="story"
          rows={6}
          maxLength={2000}
          value={story}
          placeholder="How you met, the proposal, what the celebrations mean to your families…"
          aria-invalid={fieldErrors.story ? true : undefined}
          className="border-hairline bg-field rounded-field focus:border-emerald focus:ring-emerald/15 w-full border px-4 py-3 focus:ring-2 focus:outline-none"
          onChange={(e) => {
            setStory(e.target.value);
          }}
        />
        <p className={fieldErrors.story ? "text-danger text-sm" : "text-ink-muted text-sm"}>
          {fieldErrors.story ?? `${String(story.length)} / 2,000`}
        </p>
      </div>

      <Toggle
        label="Let search engines find it"
        hint="Off by default. Never applies while a password is set."
        checked={indexable}
        onChange={setIndexable}
      />

      <Button
        className="sm:w-auto"
        disabled={busy}
        onClick={() => {
          void save(
            { published, story, indexable },
            published ? "Saved. The website is live." : "Saved.",
          );
        }}
      >
        {busy ? "Saving…" : "Save website"}
      </Button>

      <div className="border-hairline space-y-4 border-t pt-6">
        <div>
          <h3 className="font-semibold">Password</h3>
          <p className="text-ink-muted text-sm">
            {protectedSite
              ? "Visitors need the password. Changing it asks everyone for the new one."
              : "Anyone with the link can see the website. Add a password to keep it to family."}
          </p>
        </div>
        <form
          noValidate
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const value = new FormData(form).get("sitePassword");
            void save(
              { password: typeof value === "string" ? value : "" },
              "Password saved. Share it with the people you invite.",
            ).then((ok) => {
              if (ok) form.reset();
            });
          }}
        >
          <PasswordField
            label={protectedSite ? "New password" : "Password"}
            name="sitePassword"
            autoComplete="new-password"
            error={fieldErrors.password}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="secondary" className="h-11 w-auto" disabled={busy}>
              {protectedSite ? "Change password" : "Set password"}
            </Button>
            {protectedSite ? (
              <Button
                variant="secondary"
                className="h-11 w-auto"
                disabled={busy}
                onClick={() => {
                  void save({ password: null }, "Password removed.");
                }}
              >
                Remove password
              </Button>
            ) : null}
          </div>
        </form>
      </div>
    </ArchCard>
  );
}
