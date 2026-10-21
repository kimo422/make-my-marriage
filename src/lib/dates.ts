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

/** A date-only value shifted by whole days ("2026-12-12", -30 → "2026-11-12"). */
export function addDays(dateOnly: string, days: number): string {
  return formatDateOnly(new Date(parseDateOnly(dateOnly).getTime() + days * 86_400_000));
}

// Event times: people enter a wall-clock date and time in the wedding's time
// zone; the API stores and sends UTC instants.

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isTime(value: string): boolean {
  return TIME.test(value);
}

/** Minutes `timeZone` is ahead of UTC at a given instant (IST: 330). */
function offsetMinutes(timeZone: string, utcMs: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - utcMs) / 60_000);
}

/** "2026-12-11" + "19:00" in Asia/Kolkata → the UTC instant 2026-12-11T13:30:00Z. */
export function zonedToUtc(dateOnly: string, time: string, timeZone: string): Date {
  const [y = 0, m = 1, d = 1] = dateOnly.split("-").map(Number);
  const [hh = 0, mm = 0] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes settle the offset even across a daylight-saving change.
  const first = wall - offsetMinutes(timeZone, wall) * 60_000;
  return new Date(wall - offsetMinutes(timeZone, first) * 60_000);
}

/** The wall-clock date and time of a UTC instant in a time zone. */
export function utcToZoned(iso: string, timeZone: string): { date: string; time: string } {
  const at = new Date(iso);
  return {
    date: new Intl.DateTimeFormat("en-CA", { timeZone }).format(at),
    time: new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(at),
  };
}

/** "7:00 pm", shown in the wedding's time zone. */
export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone, hour: "numeric", minute: "2-digit" })
    .format(new Date(iso))
    .replace(/\s?([ap])\.?m\.?/i, (_m, ap: string) => ` ${ap.toLowerCase()}m`);
}

/** "Fri, 11 Dec 2026", shown in the wedding's time zone. */
export function formatEventDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(new Date(iso))
    .replace(/,(?= \d{4})/g, "");
}
