import { describe, expect, it } from "vitest";

import { parseCsv, toCsv } from "@/lib/csv";
import { formatPhone, normalizePhone, whatsappNumber } from "@/lib/phone";

describe("normalizePhone", () => {
  it.each([
    ["98765 43210", "+919876543210"],
    ["098765-43210", "+919876543210"],
    ["+91 98765 43210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["0091 9876543210", "+919876543210"],
    ["+1 (415) 555-0100", "+14155550100"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "12345", "not a phone", "+0123456789"])("rejects %j", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("formats for display and for wa.me", () => {
    expect(formatPhone("+919876543210")).toBe("+91 98765 43210");
    expect(whatsappNumber("+919876543210")).toBe("919876543210");
  });
});

describe("csv", () => {
  it("parses quotes, embedded commas, newlines, CRLF and a BOM", () => {
    const text = '﻿name,notes\r\n"Sharma, Ramesh","said ""hi""\nand left"\r\n\r\nPriya,\n';
    expect(parseCsv(text)).toEqual([
      ["name", "notes"],
      ["Sharma, Ramesh", 'said "hi"\nand left'],
      ["Priya", ""],
    ]);
  });

  it("writes cells that round-trip and can't run as spreadsheet formulas", () => {
    const out = toCsv([
      ["Household", "Note"],
      ["Sharma, family", '=HYPERLINK("x")'],
    ]);
    expect(out).toBe('Household,Note\r\n"Sharma, family","\'=HYPERLINK(""x"")"\r\n');
    expect(parseCsv(out)[1]).toEqual(["Sharma, family", '\'=HYPERLINK("x")']);
  });
});
