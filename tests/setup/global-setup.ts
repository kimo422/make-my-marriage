import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

// A single-node replica set, so tests can use transactions like Atlas does.
export default async function setup(project: TestProject) {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    // The first start on a new machine can be slow (binary download, antivirus scan).
    instanceOpts: [{ launchTimeout: 60_000 }],
  });
  project.provide("mongoUri", replSet.getUri());
  return async () => {
    await replSet.stop();
  };
}
