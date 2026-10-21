import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import mongoose from "mongoose";

import { connectDb } from "@/lib/db/connect";

const require = createRequire(import.meta.url);
const migrationsDir = fileURLToPath(new URL("../../migrations/", import.meta.url));

/** Runs every migration's `up`, in filename order, so tests get the real unique indexes. */
async function applyMigrations(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Test database is not connected");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".cjs"))
    .sort();
  for (const file of files) {
    const migration = require(`${migrationsDir}${file}`) as { up: (db: unknown) => Promise<void> };
    await migration.up(db);
  }
}

/** Connects to the per-worker test database, with indexes, and returns cleanup functions. */
export async function useTestDb() {
  await connectDb();
  await applyMigrations();
  return {
    /** Empties every collection, including ones mongoose has no model for (Better Auth's). */
    async clear() {
      const db = mongoose.connection.db;
      if (!db) throw new Error("Test database is not connected");
      const collections = await db.listCollections({}, { nameOnly: true }).toArray();
      await Promise.all(collections.map((c) => db.collection(c.name).deleteMany({})));
    },
    async drop() {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    },
  };
}
