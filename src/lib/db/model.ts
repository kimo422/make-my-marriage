import "server-only";

import mongoose, { type Schema } from "mongoose";

import { connectDb } from "@/lib/db/connect";

const QUERY_OPERATIONS = [
  "countDocuments",
  "deleteMany",
  "deleteOne",
  "distinct",
  "estimatedDocumentCount",
  "find",
  "findOne",
  "findOneAndDelete",
  "findOneAndReplace",
  "findOneAndUpdate",
  "replaceOne",
  "updateMany",
  "updateOne",
] as const;

/**
 * Opens the connection before any operation on this schema. On Vercel a page
 * can run in a fresh instance where nothing has connected yet (public pages
 * like /site and /r have no sign-in step to do it), and Mongoose would
 * otherwise buffer the query for 10 seconds and fail.
 */
function connectFirst(schema: Schema) {
  const connect = async () => {
    await connectDb();
  };
  schema.pre([...QUERY_OPERATIONS], { document: false, query: true }, connect);
  schema.pre("aggregate", connect);
  schema.pre("insertMany", connect);
  schema.pre("save", connect);
}

/**
 * Registers a model once per process. Next.js hot reload re-evaluates model
 * files, and mongoose throws if the same name is compiled twice.
 */
export function defineModel<TSchema extends Schema>(name: string, schema: TSchema) {
  const compile = () => {
    connectFirst(schema);
    return mongoose.model(name, schema);
  };
  const existing = mongoose.models[name];
  return existing ? (existing as unknown as ReturnType<typeof compile>) : compile();
}

/** True for MongoDB's duplicate-key error (a unique index rejected the write). */
export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000
  );
}
