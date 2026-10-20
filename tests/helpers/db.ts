import mongoose from "mongoose";

import { connectDb } from "@/lib/db/connect";

/** Connects to the per-worker test database and returns a cleanup function. */
export async function useTestDb() {
  await connectDb();
  return {
    async clear() {
      const { collections } = mongoose.connection;
      await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
    },
    async drop() {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    },
  };
}
