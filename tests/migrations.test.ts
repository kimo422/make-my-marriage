import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { useTestDb } from "@tests/helpers/db";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const authIndexes = require("../migrations/20261021000000-auth-indexes.cjs") as {
  up: (db: unknown) => Promise<void>;
  down: (db: unknown) => Promise<void>;
};

let db: Awaited<ReturnType<typeof useTestDb>>;
beforeAll(async () => {
  db = await useTestDb();
});
afterAll(async () => {
  await db.drop();
});

describe("auth index migration", () => {
  it("creates the indexes and can run twice", async () => {
    const native = mongoose.connection.db;
    await authIndexes.up(native);
    await authIndexes.up(native);
    const names = (await native?.collection("session").indexes())?.map((i) => i.name);
    expect(names).toEqual(expect.arrayContaining(["token_unique", "expiresAt_ttl"]));
    const user = await native?.collection("user").indexes();
    expect(user?.find((i) => i.name === "email_unique")?.unique).toBe(true);
  });

  it("rolls back cleanly", async () => {
    const native = mongoose.connection.db;
    await authIndexes.down(native);
    const names = (await native?.collection("session").indexes())?.map((i) => i.name);
    expect(names).toEqual(["_id_"]);
  });
});
