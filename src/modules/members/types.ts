import type { Role, Side } from "./permissions";

// Client-safe DTOs for members and invites.

export interface MembershipRecord {
  weddingId: string;
  userId: string;
  role: Role;
  side: Side;
  joinedAt: string;
}

export interface MemberDto extends MembershipRecord {
  name: string;
  email: string;
}

export interface InviteDto {
  id: string;
  email: string;
  role: Role;
  side: Side;
  status: "pending" | "accepted" | "revoked";
  expiresAt: string;
  createdAt: string;
}

export interface CreatedInviteDto {
  invite: InviteDto;
  /** Shown once; only its hash is stored. */
  inviteUrl: string;
}
