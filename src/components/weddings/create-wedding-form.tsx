"use client";

import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import { ArchCard } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { SlugField, slugify, TraditionPicker } from "@/components/weddings/wedding-fields";
import { api, ApiClientError } from "@/lib/api-client";
import { toFieldErrors } from "@/lib/validation/common";
import { createWeddingSchema } from "@/modules/weddings/schema";
import type { MyWeddingDto } from "@/modules/weddings/types";

export function CreateWeddingForm({ siteHost }: { siteHost: string }) {
  const router = useRouter();
  const [bride, setBride] = useState("");
  const [groom, setGroom] = useState("");
  const [tradition, setTradition] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const effectiveSlug = slugEdited ? slug : slugify(bride, groom);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = createWeddingSchema.safeParse({
      brideName: bride,
      groomName: groom,
      primaryDate: form.get("primaryDate"),
      city: form.get("city"),
      tradition: tradition ?? undefined,
      slug: effectiveSlug,
    });
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setPending(true);
    try {
      const wedding = await api<MyWeddingDto>("POST", "/api/weddings", parsed.data);
      router.replace(`/weddings/${wedding.id}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError && Object.keys(error.fields).length > 0) {
        setFieldErrors(error.fields);
      } else {
        setFormError(error instanceof Error ? error.message : "Something went wrong.");
      }
      setPending(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void onSubmit(event);
      }}
    >
      {formError ? (
        <div className="mb-4">
          <FormAlert>{formError}</FormAlert>
        </div>
      ) : null}
      <ArchCard className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Bride's name"
            name="brideName"
            autoComplete="off"
            placeholder="Santhvana"
            value={bride}
            error={fieldErrors.brideName}
            onChange={(e) => {
              setBride(e.target.value);
            }}
          />
          <Field
            label="Groom's name"
            name="groomName"
            autoComplete="off"
            placeholder="Balaram"
            value={groom}
            error={fieldErrors.groomName}
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
          error={fieldErrors.primaryDate}
        />

        <Field
          label="City"
          name="city"
          autoComplete="address-level2"
          placeholder="Hyderabad"
          error={fieldErrors.city}
        />

        <TraditionPicker value={tradition} onChange={setTradition} />

        <SlugField
          value={effectiveSlug}
          siteHost={siteHost}
          error={fieldErrors.slug}
          onChange={(value) => {
            setSlugEdited(true);
            setSlug(value);
          }}
        />
      </ArchCard>

      <Button type="submit" className="mt-6" disabled={pending}>
        {pending ? "Creating your wedding…" : "Create wedding →"}
      </Button>
      <p className="text-ink-muted mt-3 text-center">
        You&apos;ll be the owner. Invite parents and family next.
      </p>
    </form>
  );
}
