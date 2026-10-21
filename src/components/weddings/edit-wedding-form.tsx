"use client";

import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import { ArchCard } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { SlugField, TraditionPicker } from "@/components/weddings/wedding-fields";
import { api, ApiClientError } from "@/lib/api-client";
import { toFieldErrors } from "@/lib/validation/common";
import { updateWeddingSchema } from "@/modules/weddings/schema";
import type { MyWeddingDto, WeddingDto } from "@/modules/weddings/types";

export function EditWeddingForm({ wedding, siteHost }: { wedding: WeddingDto; siteHost: string }) {
  const router = useRouter();
  const [tradition, setTradition] = useState<string | null>(wedding.tradition);
  const [slug, setSlug] = useState(wedding.slug);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const deadline = form.get("rsvpDeadline");
    const parsed = updateWeddingSchema.safeParse({
      brideName: form.get("brideName"),
      groomName: form.get("groomName"),
      primaryDate: form.get("primaryDate"),
      city: form.get("city"),
      tradition,
      rsvpDeadline: deadline ? deadline : null,
      slug,
    });
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    setMessage(null);
    setPending(true);
    try {
      await api<MyWeddingDto>("PATCH", `/api/weddings/${wedding.id}`, parsed.data);
      setMessage({ tone: "success", text: "Saved." });
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError && Object.keys(error.fields).length)
        setFieldErrors(error.fields);
      else
        setMessage({
          tone: "error",
          text: error instanceof Error ? error.message : "Couldn't save.",
        });
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
    >
      <ArchCard className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Bride's name"
            name="brideName"
            defaultValue={wedding.brideName}
            error={fieldErrors.brideName}
          />
          <Field
            label="Groom's name"
            name="groomName"
            defaultValue={wedding.groomName}
            error={fieldErrors.groomName}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Main wedding date"
            name="primaryDate"
            type="date"
            defaultValue={wedding.primaryDate}
            error={fieldErrors.primaryDate}
          />
          <Field
            label="RSVP deadline (optional)"
            name="rsvpDeadline"
            type="date"
            defaultValue={wedding.rsvpDeadline ?? ""}
            hint="Guests can change their answer until this day."
            error={fieldErrors.rsvpDeadline}
          />
        </div>
        <Field label="City" name="city" defaultValue={wedding.city} error={fieldErrors.city} />
        <TraditionPicker value={tradition} onChange={setTradition} />
        <SlugField
          value={slug}
          onChange={setSlug}
          siteHost={siteHost}
          currentSlug={wedding.slug}
          error={fieldErrors.slug}
        />
      </ArchCard>
      {message ? <FormAlert tone={message.tone}>{message.text}</FormAlert> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
