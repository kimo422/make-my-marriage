import "server-only";

import { formatEventDay, formatLongDate, formatTime } from "@/lib/dates";
import { env } from "@/lib/env/server";
import { AppError, forbidden } from "@/lib/errors";
import { whatsappNumber } from "@/lib/phone";
import { hashToken } from "@/lib/tokens";
import { logActivity } from "@/modules/activity";
import { can } from "@/modules/members";

import * as repo from "./repo";
import type { MessageKind, Templates } from "./schema";
import { findEditableHousehold, rsvpTokenFor, type EventInfo, type GuestContext } from "./service";
import type { InviteMessageDto } from "./types";

// WhatsApp invites (API Design): the app never sends anything. It prepares a
// wa.me link with the text filled in, and the person taps send themselves.

/** Starter wording, used until the couple edits it (decision 7a: one set per wedding). */
export const DEFAULT_TEMPLATES: Templates = {
  invite: [
    "Namaste {householdName}!",
    "",
    "With joy, we invite you to celebrate the wedding of {coupleNames}.",
    "",
    "Please let us know which functions you can attend:",
    "{rsvpUrl}",
    "",
    "Kindly reply by {rsvpDeadline}. Your blessings mean the world to us.",
  ].join("\n"),
  reminder: [
    "Namaste {householdName}, a gentle reminder to RSVP for the wedding of {coupleNames}.",
    "",
    "It takes a minute: {rsvpUrl}",
    "",
    "Please reply by {rsvpDeadline}. Thank you!",
  ].join("\n"),
  eventDay: [
    "Namaste {householdName}! Today is the {eventName} for {coupleNames}.",
    "",
    "{eventDay}, {eventTime}",
    "{venue}",
    "",
    "We look forward to seeing you. Your details: {rsvpUrl}",
  ].join("\n"),
};

export interface MessageWedding {
  brideName: string;
  groomName: string;
  timezone: string;
  rsvpDeadline: string | null;
}

export async function getTemplates(weddingId: string): Promise<Templates> {
  return (await repo.findTemplates(weddingId)) ?? DEFAULT_TEMPLATES;
}

export async function saveTemplates(ctx: GuestContext, templates: Templates): Promise<Templates> {
  if (!can(ctx.membership.role, "guests.edit")) throw forbidden();
  await repo.saveTemplates(ctx.wedding.id, templates);
  return templates;
}

/** Fills `{placeholder}`s; unknown ones are left as typed so the mistake is visible. */
export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export function rsvpUrl(householdId: string, version: number): string {
  return `${env.APP_URL}/r/${rsvpTokenFor(householdId, version)}`;
}

function waLink(phone: string | null, text: string): string {
  const to = phone ? whatsappNumber(phone) : "";
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

const TEMPLATE_FOR: Record<MessageKind, keyof Templates> = {
  invite: "invite",
  reminder: "reminder",
  event_day: "eventDay",
};

/** GET .../households/:householdId/invite: the link, the text and the wa.me URL. */
export async function inviteMessage(
  ctx: GuestContext,
  wedding: MessageWedding,
  householdId: string,
  kind: MessageKind,
  events: EventInfo[],
  eventId?: string,
): Promise<InviteMessageDto> {
  const household = await findEditableHousehold(ctx, householdId);

  const [templates, guests] = await Promise.all([
    getTemplates(ctx.wedding.id),
    repo.listGuests(ctx.wedding.id, [householdId]),
  ]);
  const invited = events.filter((e) => household.invitedEventIds.includes(e.id));
  const event = eventId ? invited.find((e) => e.id === eventId) : invited[0];
  if (kind === "event_day" && !event) {
    throw new AppError("EVENT_NOT_INVITED", "This family isn't invited to that event");
  }

  const url = rsvpUrl(household.id, household.rsvpTokenVersion);
  const text = renderTemplate(templates[TEMPLATE_FOR[kind]], {
    householdName: household.name,
    coupleNames: `${wedding.brideName} & ${wedding.groomName}`,
    rsvpUrl: url,
    rsvpDeadline: wedding.rsvpDeadline ? formatLongDate(wedding.rsvpDeadline) : "the earliest",
    eventName: event?.name ?? "",
    eventDay: event ? formatEventDay(event.startAt, wedding.timezone) : "",
    eventTime: event ? formatTime(event.startAt, wedding.timezone) : "",
    venue: [event?.venue.name, event?.venue.address].filter(Boolean).join(", "),
  });
  const primary =
    guests.find((g) => g.id === household.primaryGuestId) ?? guests.find((g) => g.phone);
  const phone = primary?.phone ?? null;
  return { rsvpUrl: url, whatsappUrl: waLink(phone, text), messageText: text, phone };
}

/** After the person has sent the message from their phone. */
export async function markSent(
  ctx: GuestContext,
  householdId: string,
  kind: MessageKind,
): Promise<void> {
  await findEditableHousehold(ctx, householdId);
  // Event-day messages don't change the invite's progress.
  if (kind === "event_day") return;
  await repo.recordSent(ctx.wedding.id, householdId, kind, ctx.user.id);
}

/** Kills the old link (forwarded too widely, say) and returns the new one. */
export async function regenerateRsvpLink(
  ctx: GuestContext,
  householdId: string,
): Promise<{ rsvpUrl: string }> {
  const household = await findEditableHousehold(ctx, householdId);
  const version = household.rsvpTokenVersion + 1;
  await repo.updateHousehold(ctx.wedding.id, householdId, {
    rsvpTokenVersion: version,
    rsvpTokenHash: hashToken(rsvpTokenFor(householdId, version)),
  });
  await logActivity({
    weddingId: ctx.wedding.id,
    actorId: ctx.user.id,
    actorLabel: ctx.user.name,
    action: "regenerated_link",
    entity: "household",
    entityId: householdId,
    summary: `${ctx.user.name} made a new RSVP link for ${household.name}`,
  });
  return { rsvpUrl: rsvpUrl(householdId, version) };
}
