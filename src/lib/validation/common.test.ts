import { describe, expect, it } from "vitest";
import { z } from "zod";

import { objectId, stripOperatorKeys, toFieldErrors } from "@/lib/validation/common";

describe("stripOperatorKeys", () => {
  it("removes $ and dotted keys at any depth, including inside arrays", () => {
    expect(
      stripOperatorKeys({
        name: "Sharma family",
        $set: { role: "owner" },
        "a.b": 1,
        guests: [{ name: "Ravi", $gt: "" }],
        nested: { ok: true, $ne: null },
      }),
    ).toEqual({ name: "Sharma family", guests: [{ name: "Ravi" }], nested: { ok: true } });
  });

  it("passes primitives through", () => {
    expect(stripOperatorKeys("x")).toBe("x");
    expect(stripOperatorKeys(null)).toBeNull();
  });
});

describe("toFieldErrors", () => {
  it("keys issues by their dotted path, keeping the first per field", () => {
    const schema = z.object({ guests: z.array(z.object({ phone: z.string().min(5) })) });
    const result = schema.safeParse({ guests: [{ phone: "1" }] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(toFieldErrors(result.error))).toEqual(["guests.0.phone"]);
    }
  });
});

describe("objectId", () => {
  it("accepts 24-char hex and rejects anything else", () => {
    expect(objectId.safeParse("6712f0a1c4e8b93d5a7e2b10").success).toBe(true);
    expect(objectId.safeParse("6712f0a1").success).toBe(false);
    expect(objectId.safeParse({ $ne: null }).success).toBe(false);
  });
});
