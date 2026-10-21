// Indexes for weddings, memberships, invites and activity (Database Design, "Indexes").
// The unique ones enforce rules the app must never break; createIndex is a no-op
// when an identical index exists, so this is safe to re-run.

const DAY = 24 * 60 * 60;

/** @param {import("mongodb").Db} db */
async function up(db) {
  const weddings = db.collection("weddings");
  await weddings.createIndex({ slug: 1 }, { unique: true, name: "slug_unique" });
  await weddings.createIndex(
    { "gallery.linkTokenHash": 1 },
    {
      unique: true,
      name: "gallery_linkTokenHash_unique",
      partialFilterExpression: { "gallery.linkTokenHash": { $type: "string" } },
    },
  );
  await weddings.createIndex({ deletedAt: 1 }, { sparse: true, name: "deletedAt" });
  await weddings.createIndex({ primaryDate: 1 }, { name: "primaryDate" });

  const memberships = db.collection("memberships");
  await memberships.createIndex(
    { weddingId: 1, userId: 1 },
    { unique: true, name: "weddingId_userId_unique" },
  );
  await memberships.createIndex({ userId: 1 }, { name: "userId" });

  const invites = db.collection("invites");
  await invites.createIndex({ tokenHash: 1 }, { unique: true, name: "tokenHash_unique" });
  await invites.createIndex({ weddingId: 1, status: 1 }, { name: "weddingId_status" });
  // Old invites disappear 30 days after they expire.
  await invites.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 30 * DAY, name: "expiresAt_ttl" },
  );

  const activity = db.collection("activity");
  // The feed pages newest-first on _id.
  await activity.createIndex({ weddingId: 1, _id: -1 }, { name: "weddingId_id_desc" });
  await activity.createIndex({ at: 1 }, { expireAfterSeconds: 150 * DAY, name: "at_ttl" });
}

/** @param {import("mongodb").Db} db */
async function down(db) {
  const drops = [
    ["weddings", "slug_unique"],
    ["weddings", "gallery_linkTokenHash_unique"],
    ["weddings", "deletedAt"],
    ["weddings", "primaryDate"],
    ["memberships", "weddingId_userId_unique"],
    ["memberships", "userId"],
    ["invites", "tokenHash_unique"],
    ["invites", "weddingId_status"],
    ["invites", "expiresAt_ttl"],
    ["activity", "weddingId_id_desc"],
    ["activity", "at_ttl"],
  ];
  for (const [collection, index] of drops) {
    await db
      .collection(collection)
      .dropIndex(index)
      .catch(() => undefined);
  }
}

module.exports = { up, down };
