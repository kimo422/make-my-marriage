import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/lib/auth/redirect";

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/weddings/new?x=1", "/account")).toBe("/weddings/new?x=1");
  });

  it.each([null, "", "https://evil.example", "//evil.example", "/\\evil.example", "account"])(
    "falls back for %j",
    (value) => {
      expect(safeNextPath(value, "/account")).toBe("/account");
    },
  );
});
