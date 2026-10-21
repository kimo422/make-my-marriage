"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { SelectField } from "@/components/ui/select-field";
import { api } from "@/lib/api-client";
import {
  ROLE_LABELS,
  ROLES,
  SIDE_LABELS,
  SIDES,
  type Role,
  type Side,
} from "@/modules/members/permissions";
import type { MemberDto } from "@/modules/members/types";

interface Props {
  weddingId: string;
  members: MemberDto[];
  currentUserId: string;
  canManage: boolean;
  canManageOwners: boolean;
}

export function MemberList({
  weddingId,
  members,
  currentUserId,
  canManage,
  canManageOwners,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(userId: string, request: () => Promise<unknown>, after?: () => void) {
    setBusy(userId);
    setError(null);
    request()
      .then(() => {
        if (after) after();
        else router.refresh();
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      })
      .finally(() => {
        setBusy(null);
      });
  }

  const roleOptions = ROLES.filter((r) => canManageOwners || r !== "owner").map((r) => ({
    value: r,
    label: ROLE_LABELS[r],
  }));
  const sideOptions = SIDES.map((s) => ({ value: s, label: SIDE_LABELS[s] }));

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
      <ul className="divide-hairline border-hairline rounded-card divide-y border bg-white">
        {members.map((m) => {
          const self = m.userId === currentUserId;
          const editable = canManage && (m.role !== "owner" || canManageOwners);
          const path = `/api/weddings/${weddingId}/members/${m.userId}`;
          return (
            <li key={m.userId} className="space-y-3 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <Avatar name={m.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.name}
                    {self ? <span className="text-ink-muted font-normal"> (you)</span> : null}
                  </p>
                  <p className="text-ink-muted truncate text-sm">{m.email}</p>
                </div>
                {!editable ? (
                  <div className="flex flex-col items-end gap-1">
                    <Chip tone={m.role === "owner" ? "blush" : "stone"}>{ROLE_LABELS[m.role]}</Chip>
                    {m.side !== "both" ? (
                      <span className="text-ink-muted text-xs">{SIDE_LABELS[m.side]}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {editable ? (
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <SelectField
                    label={`Role for ${m.name}`}
                    hideLabel
                    name={`role-${m.userId}`}
                    value={m.role}
                    options={roleOptions}
                    disabled={busy === m.userId}
                    onChange={(e) => {
                      run(m.userId, () => api("PATCH", path, { role: e.target.value as Role }));
                    }}
                  />
                  <SelectField
                    label={`Side for ${m.name}`}
                    hideLabel
                    name={`side-${m.userId}`}
                    value={m.side}
                    options={sideOptions}
                    disabled={busy === m.userId}
                    onChange={(e) => {
                      run(m.userId, () => api("PATCH", path, { side: e.target.value as Side }));
                    }}
                  />
                  {!self ? (
                    <button
                      type="button"
                      disabled={busy === m.userId}
                      onClick={() => {
                        if (window.confirm(`Remove ${m.name} from this wedding?`)) {
                          run(m.userId, () => api("DELETE", path));
                        }
                      }}
                      className="text-ink-muted hover:bg-stone hover:text-ink h-12 rounded-full px-4 text-sm"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ) : null}

              {self ? (
                <button
                  type="button"
                  disabled={busy === m.userId}
                  onClick={() => {
                    if (
                      window.confirm("Leave this wedding? You'll need a new invite to come back.")
                    ) {
                      run(
                        m.userId,
                        () => api("DELETE", path),
                        () => {
                          router.replace("/weddings?pick=1");
                          router.refresh();
                        },
                      );
                    }
                  }}
                  className="text-ink-muted hover:text-ink text-sm underline underline-offset-4"
                >
                  Leave this wedding
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
