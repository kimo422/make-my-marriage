// migrate-mongo settings. Migrations build indexes and reshape data; the app
// never builds indexes itself (autoIndex is off). Each script must be safe to re-run.
const { existsSync } = require("node:fs");

// Locally, read .env.local; in CI the variables come from the job environment.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

module.exports = {
  mongodb: {
    url: process.env.MONGODB_URI,
    databaseName: process.env.MONGODB_DB || "mmm",
  },
  migrationsDir: "migrations",
  changelogCollectionName: "changelog",
  lockCollectionName: "changelog_lock",
  lockTtl: 300,
  migrationFileExtension: ".cjs",
  useFileHash: false,
  moduleSystem: "commonjs",
};
