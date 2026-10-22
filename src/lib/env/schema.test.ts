import { describe, expect, it } from "vitest";

import { parseServerEnv } from "@/lib/env/schema";

const valid = {
  APP_URL: "http://localhost:3000",
  MONGODB_URI: "mongodb://localhost:27017",
  BETTER_AUTH_SECRET: "x".repeat(32),
  TOKEN_SECRET: "y".repeat(32),
};

describe("parseServerEnv", () => {
  it("applies defaults", () => {
    expect(parseServerEnv(valid)).toMatchObject({ MONGODB_DB: "mmm", LOG_LEVEL: "info" });
  });

  it("names every missing or invalid variable", () => {
    expect(() => parseServerEnv({ APP_URL: "not a url" })).toThrow(/APP_URL[\s\S]*MONGODB_URI/);
  });

  it("requires a public https APP_URL on Vercel production", () => {
    expect(() => parseServerEnv({ ...valid, VERCEL_ENV: "production" })).toThrow(
      /public https address[\s\S]*at APP_URL/,
    );
    expect(
      parseServerEnv({
        ...valid,
        VERCEL_ENV: "production",
        APP_URL: "https://make-my-marriage.vercel.app",
      }).APP_URL,
    ).toBe("https://make-my-marriage.vercel.app");
    expect(parseServerEnv({ ...valid, VERCEL_ENV: "preview" }).APP_URL).toBe(valid.APP_URL);
  });
});
