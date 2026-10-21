import mongoose from "mongoose";

import { connectDb } from "@/lib/db/connect";

/** Connects to the per-worker test database and returns a cleanup function. */
export async function useTestDb() {
  await connectDb();
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
