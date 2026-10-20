import "server-only";

import mongoose, { type ClientSession, type Mongoose } from "mongoose";

import { env } from "@/lib/env/server";

// Unknown filter fields are dropped instead of being sent to MongoDB, so a stray
// key from user input can never widen a query.
mongoose.set("strictQuery", true);
// Indexes are built by migrations, never on app start.
mongoose.set("autoIndex", false);

interface MongooseCache {
  promise: Promise<Mongoose> | null;
}

const globalForMongoose = globalThis as typeof globalThis & { __mongoose?: MongooseCache };

// One connection per function instance, reused by warm invocations and by
// Next.js hot reload in development.
const cache: MongooseCache = (globalForMongoose.__mongoose ??= { promise: null });

export function connectDb(): Promise<Mongoose> {
  cache.promise ??= mongoose
    .connect(env.MONGODB_URI, {
      dbName: env.MONGODB_DB,
      // Many function instances can run at once and the free cluster caps
      // total connections, so each instance keeps a small pool.
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5_000,
    })
    .catch((error: unknown) => {
      cache.promise = null;
      throw error;
    });
  return cache.promise;
}

export async function pingDb(): Promise<void> {
  const { connection } = await connectDb();
  if (!connection.db) throw new Error("MongoDB connection has no database handle");
  await connection.db.admin().ping();
}

// Runs fn in a transaction, retrying on transient errors. Use it only where two
// or more writes must succeed or fail together (see the Database Design).
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const { connection } = await connectDb();
  return connection.transaction(fn);
}
