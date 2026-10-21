// Indexes for events and tasks (Database Design, "Indexes"). Safe to re-run.

/** @param {import("mongodb").Db} db */
async function up(db) {
  const events = db.collection("events");
  await events.createIndex({ weddingId: 1, order: 1 }, { name: "weddingId_order" });
  await events.createIndex({ weddingId: 1, startAt: 1 }, { name: "weddingId_startAt" });

  const tasks = db.collection("tasks");
  // The board: columns by status, cards by position.
  await tasks.createIndex(
    { weddingId: 1, status: 1, boardOrder: 1 },
    { name: "weddingId_status_boardOrder" },
  );
  // "My tasks" and the overdue list.
  await tasks.createIndex(
    { weddingId: 1, assigneeId: 1, dueAt: 1 },
    { name: "weddingId_assigneeId_dueAt" },
  );
  // Filter by event, and unlinking when an event is deleted.
  await tasks.createIndex({ weddingId: 1, eventId: 1 }, { name: "weddingId_eventId" });
}

/** @param {import("mongodb").Db} db */
async function down(db) {
  const drops = [
    ["events", "weddingId_order"],
    ["events", "weddingId_startAt"],
    ["tasks", "weddingId_status_boardOrder"],
    ["tasks", "weddingId_assigneeId_dueAt"],
    ["tasks", "weddingId_eventId"],
  ];
  for (const [collection, index] of drops) {
    await db
      .collection(collection)
      .dropIndex(index)
      .catch(() => undefined);
  }
}

module.exports = { up, down };
