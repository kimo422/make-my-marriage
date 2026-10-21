import type { EventType } from "./schema";

// Client-safe event DTOs. startAt/endAt are UTC ISO instants; show them in the
// wedding's time zone.

export interface VenueDto {
  name: string | null;
  address: string | null;
  mapUrl: string | null;
}

export interface EventDto {
  id: string;
  name: string;
  type: EventType;
  startAt: string;
  endAt: string;
  venue: VenueDto;
  dressCode: string | null;
  notes: string | null;
  isPublic: boolean;
  order: number;
  updatedAt: string;
}

/** What deleting an event would affect; the UI shows it before confirming. */
export interface EventImpactDto {
  tasksUnlinked: number;
  /** RSVPs arrive in Phase 4 and photos in Phase 6; counted from then on. */
  rsvpsRemoved: number;
  photosMoved: number;
}
