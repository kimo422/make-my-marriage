"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void authClient.signOut().then(() => {
          router.replace("/sign-in");
          router.refresh();
        });
      }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
