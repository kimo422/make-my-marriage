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

/** The website settings as the dashboard sees them; the password itself is never returned. */
export interface WebsiteSettingsDto {
  published: boolean;
  story: string;
  passwordProtected: boolean;
  indexable: boolean;
  publishedAt: string | null;
  /** The public address, /site/<slug>. */
  url: string;
}

export interface PublicSiteEventDto {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  venue: { name: string | null; address: string | null; mapUrl: string | null };
  dressCode: string | null;
}

/** What the public website shows; `locked` while a password is needed. */
export type PublicSiteDto =
  | { locked: true; brideName: string; groomName: string }
  | {
      locked: false;
      brideName: string;
      groomName: string;
      primaryDate: string;
      city: string;
      tradition: string | null;
      timezone: string;
      story: string;
      indexable: boolean;
      events: PublicSiteEventDto[];
    };
