import type { HouseholdSide, ImportRow, MessageState } from "./schema";

// Client-safe DTOs. Phone and email are null for anyone without
// `guests.viewContacts` (viewers), never just hidden in the UI.

export interface GuestDto {
  id: string;
  householdId: string;
  name: string;
  phone: string | null;
  email: string | null;
  relation: string | null;
  isChild: boolean;
}

export interface MessageStatusDto {
  state: MessageState;
  sentAt: string | null;
  firstOpenedAt: string | null;
  lastReminderAt: string | null;
  reminderCount: number;
}

export interface RsvpDto {
  eventId: string;
  attending: boolean;
  headcount: number;
  source: "guest" | "organizer";
  respondedAt: string;
}

export interface HouseholdDto {
  id: string;
  name: string;
  side: HouseholdSide;
  group: string | null;
  maxHeadcount: number;
  invitedEventIds: string[];
  primaryGuestId: string | null;
  notes: string | null;
  message: MessageStatusDto;
  guests: GuestDto[];
  rsvps: RsvpDto[];
  importBatchId: string | null;
  updatedAt: string;
}

export interface EventRsvpSummaryDto {
  eventId: string;
  invitedHouseholds: number;
  invitedHeadcount: number;
  attendingHouseholds: number;
  declinedHouseholds: number;
  pendingHouseholds: number;
  attendingHeadcount: number;
}

export interface InviteMessageDto {
  rsvpUrl: string;
  whatsappUrl: string;
  messageText: string;
  /** The number the message goes to, or null to pick a contact in WhatsApp. */
  phone: string | null;
}

export interface ImportPreviewDto {
  rows: ImportRow[];
  /** Problems that stop a row from importing, by CSV line number. */
  errors: { line: number; message: string }[];
  /** Rows whose phone already belongs to a guest (or another row): imported anyway, flagged. */
  duplicates: { line: number; phone: string; existing: string }[];
  households: number;
}

export interface ImportResultDto {
  importBatchId: string;
  households: number;
  guests: number;
}
