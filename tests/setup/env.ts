import { inject } from "vitest";

// Runs in each test worker before any test file is imported, so
// src/lib/env/server.ts validates these values.
process.env.APP_URL = "http://localhost:3000";
process.env.MONGODB_URI = inject("mongoUri");
process.env.MONGODB_DB = `mmm_test_${String(process.pid)}`;
process.env.LOG_LEVEL = "silent";
