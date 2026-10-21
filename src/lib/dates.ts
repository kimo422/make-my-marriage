// Date-only values (a wedding day, an RSVP deadline) travel as "YYYY-MM-DD" and
// are stored as UTC midnight. Client-safe.

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "12 Dec 2026", the app's display format (Indian convention, DD MMM YYYY). */
export function formatLongDate(dateOnly: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(parseDateOnly(dateOnly))
    .replace(/,/g, "");
}

/** Today's calendar date in a time zone, as "YYYY-MM-DD". */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

/** Whole days from today (in `timeZone`) until a date-only value; negative once it has passed. */
export function daysUntil(dateOnly: string, timeZone: string, now: Date = new Date()): number {
  const ms = parseDateOnly(dateOnly).getTime() - parseDateOnly(todayIn(timeZone, now)).getTime();
  return Math.round(ms / 86_400_000);
}
