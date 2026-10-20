import { describe, expect, it } from "vitest";

import { parseServerEnv } from "@/lib/env/schema";

const valid = { APP_URL: "http://localhost:3000", MONGODB_URI: "mongodb://localhost:27017" };

describe("parseServerEnv", () => {
  it("applies defaults", () => {
    expect(parseServerEnv(valid)).toMatchObject({ MONGODB_DB: "mmm", LOG_LEVEL: "info" });
  });

  it("names every missing or invalid variable", () => {
    expect(() => parseServerEnv({ APP_URL: "not a url" })).toThrow(/APP_URL[\s\S]*MONGODB_URI/);
  });
});
