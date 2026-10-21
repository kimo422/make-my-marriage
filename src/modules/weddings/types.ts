import type { Role, Side } from "@/modules/members/permissions";

// Client-safe wedding DTOs. Dates are "YYYY-MM-DD"; timestamps are ISO strings.

export interface WeddingDto {
  id: string;
  brideName: string;
  groomName: string;
  primaryDate: string;
  city: string;
  tradition: string | null;
  timezone: string;
  slug: string;
  rsvpDeadline: string | null;
  deletedAt: string | null;
}

/** A wedding as seen by one member: the record plus their role and side. */
export interface MyWeddingDto extends WeddingDto {
  role: Role;
  side: Side;
}

export interface SlugAvailabilityDto {
  slug: string;
  available: boolean;
}
