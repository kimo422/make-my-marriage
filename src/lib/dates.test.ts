import { describe, expect, it } from "vitest";

import {
  addDays,
  daysUntil,
  formatEventDay,
  formatLongDate,
  formatTime,
  isDateOnly,
  isTime,
  utcToZoned,
  zonedToUtc,
} from "@/lib/dates";

describe("date-only values", () => {
  it("validates real calendar dates", () => {
    expect(isDateOnly("2026-12-12")).toBe(true);
    expect(isDateOnly("2026-02-30")).toBe(false);
    expect(isDateOnly("12-12-2026")).toBe(false);
  });

  it("formats as DD MMM YYYY and shifts by days", () => {
    expect(formatLongDate("2026-12-12")).toBe("12 Dec 2026");
    expect(addDays("2026-12-12", -30)).toBe("2026-11-12");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts days to go in the wedding's time zone", () => {
    // 23:00 UTC on 20 Oct is already 21 Oct in India.
    const now = new Date("2026-10-20T23:00:00Z");
    expect(daysUntil("2026-12-12", "Asia/Kolkata", now)).toBe(52);
    expect(daysUntil("2026-12-12", "UTC", now)).toBe(53);
  });
});

describe("event times", () => {
  it("converts IST wall-clock times to UTC and back", () => {
    const utc = zonedToUtc("2026-12-11", "19:00", "Asia/Kolkata");
    expect(utc.toISOString()).toBe("2026-12-11T13:30:00.000Z");
    expect(utcToZoned(utc.toISOString(), "Asia/Kolkata")).toEqual({
      date: "2026-12-11",
      time: "19:00",
    });
  });

  it("crosses midnight correctly", () => {
    const utc = zonedToUtc("2026-12-12", "02:00", "Asia/Kolkata");
    expect(utc.toISOString()).toBe("2026-12-11T20:30:00.000Z");
  });

  it("handles zones with daylight saving", () => {
    // London is on BST (UTC+1) in July and GMT in December.
    expect(zonedToUtc("2026-07-01", "10:00", "Europe/London").toISOString()).toBe(
      "2026-07-01T09:00:00.000Z",
    );
    expect(zonedToUtc("2026-12-01", "10:00", "Europe/London").toISOString()).toBe(
      "2026-12-01T10:00:00.000Z",
    );
  });

  it("formats for display in the wedding's zone", () => {
    expect(formatTime("2026-12-11T13:30:00.000Z", "Asia/Kolkata")).toBe("7:00 pm");
    expect(formatEventDay("2026-12-11T13:30:00.000Z", "Asia/Kolkata")).toBe("Fri, 11 Dec 2026");
  });

  it("validates HH:mm", () => {
    expect(isTime("19:00")).toBe(true);
    expect(isTime("24:00")).toBe(false);
    expect(isTime("7:00")).toBe(false);
  });
});
