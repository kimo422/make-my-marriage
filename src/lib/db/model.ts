import "server-only";

import mongoose, { type Schema } from "mongoose";

/**
 * Registers a model once per process. Next.js hot reload re-evaluates model
 * files, and mongoose throws if the same name is compiled twice.
 */
export function defineModel<TSchema extends Schema>(name: string, schema: TSchema) {
  const compile = () => mongoose.model(name, schema);
  const existing = mongoose.models[name];
  return existing ? (existing as unknown as ReturnType<typeof compile>) : compile();
}

/** True for MongoDB's duplicate-key error (a unique index rejected the write). */
export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000
  );
}
