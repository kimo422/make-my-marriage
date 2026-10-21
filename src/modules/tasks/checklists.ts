import type { EventType } from "@/modules/events/schema";

// Starter checklists (FR-5.3), drafted for review. Client-safe data: the
// import screen lists these, and importing turns the ticked ones into normal
// tasks. `daysBefore` counts back from the event's date (or, for the general
// list, the main wedding date); due dates already past are set to today.

export interface ChecklistItem {
  id: string;
  title: string;
  daysBefore: number;
  priority: "low" | "medium" | "high";
}

export const GENERAL_CHECKLIST: readonly ChecklistItem[] = [
  {
    id: "gen-muhurtham",
    title: "Fix the muhurtham with the family priest",
    daysBefore: 180,
    priority: "high",
  },
  {
    id: "gen-budget",
    title: "Agree the overall budget with both families",
    daysBefore: 170,
    priority: "high",
  },
  { id: "gen-venue", title: "Book the main wedding venue", daysBefore: 160, priority: "high" },
  {
    id: "gen-caterer",
    title: "Book the caterer and plan a menu tasting",
    daysBefore: 120,
    priority: "high",
  },
  {
    id: "gen-photo",
    title: "Book the photographer and videographer",
    daysBefore: 120,
    priority: "high",
  },
  { id: "gen-decor", title: "Book the decorator", daysBefore: 90, priority: "medium" },
  {
    id: "gen-bride-outfits",
    title: "Shop for the bride's outfits and jewellery",
    daysBefore: 90,
    priority: "medium",
  },
  {
    id: "gen-groom-outfits",
    title: "Shop for the groom's outfits",
    daysBefore: 75,
    priority: "medium",
  },
  {
    id: "gen-guest-list",
    title: "Finalise the guest list with both sides",
    daysBefore: 75,
    priority: "high",
  },
  { id: "gen-makeup", title: "Book makeup and hair artists", daysBefore: 60, priority: "medium" },
  {
    id: "gen-stay",
    title: "Block hotel rooms for outstation guests",
    daysBefore: 60,
    priority: "medium",
  },
  { id: "gen-invites", title: "Send invitations", daysBefore: 45, priority: "high" },
  {
    id: "gen-transport",
    title: "Arrange pickups and transport for guests",
    daysBefore: 30,
    priority: "medium",
  },
  { id: "gen-return-gifts", title: "Order return gifts", daysBefore: 30, priority: "low" },
  {
    id: "gen-headcount",
    title: "Confirm the final headcount with the caterer",
    daysBefore: 7,
    priority: "high",
  },
  {
    id: "gen-payments",
    title: "Prepare vendor payments and envelopes",
    daysBefore: 3,
    priority: "medium",
  },
  {
    id: "gen-emergency-kit",
    title: "Pack a wedding-day emergency kit",
    daysBefore: 2,
    priority: "low",
  },
];

export const EVENT_CHECKLISTS: Readonly<Partial<Record<EventType, readonly ChecklistItem[]>>> = {
  engagement: [
    { id: "eng-rings", title: "Buy the engagement rings", daysBefore: 30, priority: "high" },
    { id: "eng-venue", title: "Book the engagement venue", daysBefore: 30, priority: "high" },
    {
      id: "eng-priest",
      title: "Confirm the priest and ceremony items",
      daysBefore: 14,
      priority: "medium",
    },
    { id: "eng-sweets", title: "Order sweets for both families", daysBefore: 3, priority: "low" },
  ],
  haldi: [
    {
      id: "haldi-space",
      title: "Decide where the haldi will happen",
      daysBefore: 30,
      priority: "medium",
    },
    {
      id: "haldi-dress",
      title: "Share the yellow dress code with family",
      daysBefore: 14,
      priority: "low",
    },
    {
      id: "haldi-flowers",
      title: "Order flowers and marigold garlands",
      daysBefore: 5,
      priority: "medium",
    },
    {
      id: "haldi-paste",
      title: "Arrange turmeric paste ingredients",
      daysBefore: 3,
      priority: "high",
    },
    {
      id: "haldi-towels",
      title: "Keep towels and old clothes ready",
      daysBefore: 1,
      priority: "low",
    },
  ],
  mehendi: [
    { id: "mehendi-artists", title: "Book mehendi artists", daysBefore: 45, priority: "high" },
    { id: "mehendi-music", title: "Plan music for the evening", daysBefore: 7, priority: "low" },
    {
      id: "mehendi-seating",
      title: "Arrange low seating and cushions",
      daysBefore: 7,
      priority: "medium",
    },
    { id: "mehendi-snacks", title: "Order snacks and chai", daysBefore: 3, priority: "medium" },
  ],
  sangeet: [
    { id: "sangeet-choreo", title: "Book a choreographer", daysBefore: 60, priority: "medium" },
    { id: "sangeet-dj", title: "Book the DJ and sound", daysBefore: 45, priority: "high" },
    {
      id: "sangeet-lineup",
      title: "Make the performance list and rehearsal plan",
      daysBefore: 30,
      priority: "medium",
    },
    {
      id: "sangeet-stage",
      title: "Confirm stage and lighting",
      daysBefore: 21,
      priority: "medium",
    },
    { id: "sangeet-emcee", title: "Choose an emcee", daysBefore: 14, priority: "low" },
  ],
  wedding: [
    {
      id: "wedding-priest",
      title: "Confirm the priest and list the puja items",
      daysBefore: 30,
      priority: "high",
    },
    {
      id: "wedding-baraat",
      title: "Arrange the baraat (band, horse or car)",
      daysBefore: 30,
      priority: "medium",
    },
    {
      id: "wedding-mandap",
      title: "Finalise the mandap decoration",
      daysBefore: 21,
      priority: "medium",
    },
    {
      id: "wedding-ritual-items",
      title: "Collect ritual items (mangalsutra, garlands, rice)",
      daysBefore: 14,
      priority: "high",
    },
    {
      id: "wedding-jewellery",
      title: "Check and pack the jewellery",
      daysBefore: 7,
      priority: "high",
    },
    {
      id: "wedding-vidaai",
      title: "Book the car for the vidaai",
      daysBefore: 7,
      priority: "medium",
    },
  ],
  reception: [
    {
      id: "reception-stage",
      title: "Finalise the stage decoration",
      daysBefore: 21,
      priority: "medium",
    },
    {
      id: "reception-photo-booth",
      title: "Set up a photo corner",
      daysBefore: 14,
      priority: "low",
    },
    {
      id: "reception-seating",
      title: "Plan seating for elders and VIPs",
      daysBefore: 7,
      priority: "medium",
    },
    {
      id: "reception-gifts",
      title: "Arrange a gift table and someone to keep a register",
      daysBefore: 3,
      priority: "medium",
    },
  ],
};

export function checklistFor(type: EventType | null): readonly ChecklistItem[] {
  return type ? (EVENT_CHECKLISTS[type] ?? []) : GENERAL_CHECKLIST;
}
