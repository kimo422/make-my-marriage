import mongoose, { Schema, Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { withTransaction } from "@/lib/db/connect";
import { TenantScopeError, tenantGuard } from "@/lib/db/tenant-guard";
import { useTestDb } from "@tests/helpers/db";

const noteSchema = new Schema({
  weddingId: { type: Schema.Types.ObjectId, required: true },
  text: { type: String, required: true },
});
noteSchema.plugin(tenantGuard);
const Note = mongoose.model("GuardTestNote", noteSchema);

const weddingA = new Types.ObjectId();
const weddingB = new Types.ObjectId();

let db: Awaited<ReturnType<typeof useTestDb>>;

beforeAll(async () => {
  db = await useTestDb();
  await Note.createCollection();
});
beforeEach(async () => {
  await db.clear();
  await Note.create([
    { weddingId: weddingA, text: "a" },
    { weddingId: weddingB, text: "b" },
  ]);
});
afterAll(async () => {
  await db.drop();
});

describe("tenantGuard", () => {
  it("allows queries scoped to a wedding", async () => {
    const notes = await Note.find({ weddingId: weddingA }).lean();
    expect(notes.map((n) => n.text)).toEqual(["a"]);
  });

  it.each([
    ["find", () => Note.find({})],
    ["findOne by _id", () => Note.findOne({ _id: new Types.ObjectId() })],
    ["countDocuments", () => Note.countDocuments({})],
    ["updateOne", () => Note.updateOne({ text: "a" }, { text: "x" })],
    ["updateMany", () => Note.updateMany({}, { text: "x" })],
    ["deleteOne", () => Note.deleteOne({ text: "a" })],
    ["deleteMany", () => Note.deleteMany({})],
    ["findOneAndUpdate", () => Note.findOneAndUpdate({ text: "a" }, { text: "x" })],
  ])("rejects %s without a weddingId", async (_name, run) => {
    await expect(run()).rejects.toBeInstanceOf(TenantScopeError);
  });

  it("leaves data untouched when a query is rejected", async () => {
    await expect(Note.deleteMany({})).rejects.toThrow(TenantScopeError);
    expect(await Note.countDocuments({ weddingId: weddingB })).toBe(1);
  });

  it("allows a deliberate cross-tenant lookup", async () => {
    const note = await Note.findOne({ text: "b" }).setOptions({ tenantScope: "global" }).lean();
    expect(note?.weddingId.toString()).toBe(weddingB.toString());
  });

  it("requires aggregations to start with a weddingId $match", async () => {
    await expect(Note.aggregate([{ $group: { _id: null, n: { $sum: 1 } } }])).rejects.toThrow(
      TenantScopeError,
    );
    const rows = await Note.aggregate<{ n: number }>([
      { $match: { weddingId: weddingA } },
      { $group: { _id: null, n: { $sum: 1 } } },
    ]);
    expect(rows[0]?.n).toBe(1);
  });
});

describe("withTransaction", () => {
  it("rolls back every write when one fails", async () => {
    await expect(
      withTransaction(async (session) => {
        await Note.create([{ weddingId: weddingA, text: "in-tx" }], { session });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await Note.countDocuments({ weddingId: weddingA, text: "in-tx" })).toBe(0);
  });

  it("commits when the callback succeeds", async () => {
    await withTransaction(async (session) => {
      await Note.create([{ weddingId: weddingA, text: "committed" }], { session });
    });
    expect(await Note.countDocuments({ weddingId: weddingA, text: "committed" })).toBe(1);
  });
});
