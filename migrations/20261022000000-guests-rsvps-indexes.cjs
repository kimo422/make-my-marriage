// Indexes for households, guests, RSVPs, message templates and rate limits
// (Database Design, "Indexes"). Safe to re-run.

/** @param {import("mongodb").Db} db */
async function up(db) {
  const households = db.collection("households");
  // The guest's RSVP page looks the household up by its link.
  await households.createIndex({ rsvpTokenHash: 1 }, { name: "rsvpTokenHash", unique: true });
  // Guest list by side, sorted by name without regard to case (the list query uses the same collation).
  await households.createIndex(
    { weddingId: 1, side: 1, name: 1 },
    { name: "weddingId_side_name", collation: { locale: "en", strength: 2 } },
  );
  // WhatsApp invite and reminder queue.
  await households.createIndex(
    { weddingId: 1, "message.state": 1 },
    { name: "weddingId_messageState" },
  );
  // Invited count per event, and un-inviting when an event is deleted.
  await households.createIndex(
    { weddingId: 1, invitedEventIds: 1 },
    { name: "weddingId_invitedEventIds" },
  );
  // Undoing a CSV import.
  await households.createIndex(
    { weddingId: 1, importBatchId: 1 },
    {
      name: "weddingId_importBatchId",
      partialFilterExpression: { importBatchId: { $type: "string" } },
    },
  );

  const guests = db.collection("guests");
  await guests.createIndex({ weddingId: 1, householdId: 1 }, { name: "weddingId_householdId" });
  // Duplicate check on CSV import.
  await guests.createIndex({ weddingId: 1, phone: 1 }, { name: "weddingId_phone" });

  const rsvps = db.collection("rsvps");
  // One answer per household and event: the upsert key.
  await rsvps.createIndex(
    { householdId: 1, eventId: 1 },
    { name: "householdId_eventId", unique: true },
  );
  // RSVP summary per event.
  await rsvps.createIndex({ weddingId: 1, eventId: 1 }, { name: "weddingId_eventId" });

  await db
    .collection("messageTemplates")
    .createIndex({ weddingId: 1 }, { name: "weddingId", unique: true });

  const rateLimits = db.collection("rateLimits");
  await rateLimits.createIndex({ key: 1 }, { name: "key", unique: true });
  await rateLimits.createIndex({ expiresAt: 1 }, { name: "expiresAt_ttl", expireAfterSeconds: 0 });
}

/** @param {import("mongodb").Db} db */
async function down(db) {
  const drops = [
    ["households", "rsvpTokenHash"],
    ["households", "weddingId_side_name"],
    ["households", "weddingId_messageState"],
    ["households", "weddingId_invitedEventIds"],
    ["households", "weddingId_importBatchId"],
    ["guests", "weddingId_householdId"],
    ["guests", "weddingId_phone"],
    ["rsvps", "householdId_eventId"],
    ["rsvps", "weddingId_eventId"],
    ["messageTemplates", "weddingId"],
    ["rateLimits", "key"],
    ["rateLimits", "expiresAt_ttl"],
  ];
  for (const [collection, index] of drops) {
    await db
      .collection(collection)
      .dropIndex(index)
      .catch(() => undefined);
  }
}

module.exports = { up, down };
