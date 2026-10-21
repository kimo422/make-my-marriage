import type { Metadata } from "next";
import { Suspense } from "react";

import { FormFallback } from "@/components/auth/form-fallback";
import { InvitePanel } from "@/components/members/invite-panel";
import { MemberList } from "@/components/members/member-list";
import { can, listInvites, listMembers } from "@/modules/members";

import { loadWedding } from "@/app/(app)/weddings/[weddingId]/load";

export const metadata: Metadata = { title: "Members" };

export default function MembersPage({ params }: PageProps<"/weddings/[weddingId]/members">) {
  return (
    <Suspense fallback={<FormFallback fields={3} />}>
      <Members params={params} />
    </Suspense>
  );
}

async function Members({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { wedding, membership, user } = await loadWedding(
    weddingId,
    `/weddings/${weddingId}/members`,
    "members.view",
  );
  const canManage = can(membership.role, "members.manage");
  const canManageOwners = can(membership.role, "members.manageOwners");
  const [members, invites] = await Promise.all([
    listMembers(wedding.id),
    canManage ? listInvites(wedding.id) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[2rem] leading-tight tracking-tight">Members</h1>
        <p className="text-ink-muted mt-1">
          Everyone planning this wedding. Organizers only see guests from their side.
        </p>
      </div>
      {canManage ? (
        <InvitePanel
          weddingId={wedding.id}
          coupleNames={`${wedding.brideName} & ${wedding.groomName}`}
          invites={invites}
          canManageOwners={canManageOwners}
        />
      ) : null}
      <MemberList
        weddingId={wedding.id}
        members={members}
        currentUserId={user.id}
        canManage={canManage}
        canManageOwners={canManageOwners}
      />
    </div>
  );
}
