"use client";

import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import { api, ApiClientError } from "@/lib/api-client";

/** The password page of a protected wedding website. */
export function SiteUnlock({ slug }: { slug: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = new FormData(e.currentTarget).get("password");
    if (typeof password !== "string" || !password) {
      setError("Enter the password");
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      await api("POST", `/api/public/site/${slug}/unlock`, { password });
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError && err.fields.password
          ? err.fields.password
          : err instanceof Error
            ? err.message
            : "Couldn't check the password.",
      );
      setPending(false);
    }
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        void onSubmit(e);
      }}
    >
      <PasswordField label="Password" name="password" autoComplete="off" error={error} />
      <Button type="submit" disabled={pending}>
        {pending ? "Checking…" : "Open the website"}
      </Button>
    </form>
  );
}
