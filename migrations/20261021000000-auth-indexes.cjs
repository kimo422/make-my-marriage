// Indexes for Better Auth's collections (Database Design, "Indexes").
// createIndex is a no-op when an identical index exists, so this is safe to re-run.

/** @param {import("mongodb").Db} db */
async function up(db) {
  await db.collection("user").createIndex({ email: 1 }, { unique: true, name: "email_unique" });

  const session = db.collection("session");
  await session.createIndex({ token: 1 }, { unique: true, name: "token_unique" });
  await session.createIndex({ userId: 1 }, { name: "userId" });
  // Removes expired sessions automatically.
  await session.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "expiresAt_ttl" });

  await db
    .collection("account")
    .createIndex({ userId: 1, providerId: 1 }, { name: "userId_providerId" });

  const verification = db.collection("verification");
  await verification.createIndex({ identifier: 1 }, { name: "identifier" });
  // Password-reset tokens disappear an hour after they're issued.
  await verification.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: "expiresAt_ttl" },
  );

  await db.collection("rateLimit").createIndex({ key: 1 }, { unique: true, name: "key_unique" });
}

/** @param {import("mongodb").Db} db */
async function down(db) {
  const drops = [
    ["user", "email_unique"],
    ["session", "token_unique"],
    ["session", "userId"],
    ["session", "expiresAt_ttl"],
    ["account", "userId_providerId"],
    ["verification", "identifier"],
    ["verification", "expiresAt_ttl"],
    ["rateLimit", "key_unique"],
  ];
  for (const [collection, index] of drops) {
    await db
      .collection(collection)
      .dropIndex(index)
      .catch(() => undefined);
  }
}

module.exports = { up, down };
