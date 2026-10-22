import "server-only";

import { z } from "zod";

import { parseCsv } from "@/lib/csv";
import { withTransaction } from "@/lib/db/connect";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { normalizePhone } from "@/lib/phone";
import { logActivity } from "@/modules/activity";
import { can } from "@/modules/members";

import * as repo from "./repo";
import { MAX_HEADCOUNT, type HouseholdSide, type ImportRow } from "./schema";
import { prepareHousehold, type EventInfo, type GuestContext } from "./service";
import type { ImportPreviewDto, ImportResultDto } from "./types";

// CSV import is two steps (API Design): preview parses and checks with nothing
// saved; commit writes the rows the person saw. Undo works for 24 hours.

export const MAX_IMPORT_ROWS = 2000;
export const UNDO_WINDOW_HOURS = 24;

type Column = Exclude<keyof ImportRow, "line">;

/** Header spellings people actually use, compared without case, spaces or punctuation. */
const HEADER_ALIASES: Record<Column, string[]> = {
  household: ["household", "family", "householdname", "familyname"],
  name: ["name", "guest", "guestname", "fullname"],
  phone: ["phone", "mobile", "whatsapp", "phonenumber", "mobilenumber", "contact"],
  email: ["email", "emailaddress", "mail"],
  side: ["side"],
  relation: ["relation", "relationship"],
  group: ["group", "category"],
  maxHeadcount: ["maxheadcount", "headcount", "seats", "pax", "count"],
  isChild: ["child", "ischild", "kid"],
  notes: ["notes", "note", "comments"],
};

const squash = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

function mapHeader(header: string[]): Partial<Record<Column, number>> {
  const columns: Partial<Record<Column, number>> = {};
  header.forEach((cell, index) => {
    const key = squash(cell);
    for (const [column, aliases] of Object.entries(HEADER_ALIASES) as [Column, string[]][]) {
      if (aliases.includes(key)) columns[column] ??= index;
    }
  });
  return columns;
}

function parseSide(value: string): HouseholdSide | null {
  const v = squash(value);
  if (["bride", "b", "bridesside", "brideside", "ladkiwale"].includes(v)) return "bride";
  if (["groom", "g", "groomsside", "groomside", "ladkewale"].includes(v)) return "groom";
  return null;
}

const email = z.email();
const TRUTHY = new Set(["yes", "y", "true", "1", "child", "kid"]);

/** The organizer's own side, when they have just one: the default for rows without a side. */
function ownSide(ctx: GuestContext): HouseholdSide | null {
  const { role, side } = ctx.membership;
  return role === "organizer" && side !== "both" ? side : null;
}

const householdKey = (row: Pick<ImportRow, "side" | "household">) =>
  `${row.side}|${row.household.trim().toLowerCase()}`;

/** Parses and checks a CSV file. Nothing is saved. */
export async function previewImport(ctx: GuestContext, text: string): Promise<ImportPreviewDto> {
  if (!can(ctx.membership.role, "guests.edit")) throw forbidden();
  const [header, ...lines] = parseCsv(text);
  if (!header || lines.length === 0) {
    throw new AppError("VALIDATION_FAILED", "The file has no guests in it", {
      fields: { file: "Add a header row and at least one guest" },
    });
  }
  if (lines.length > MAX_IMPORT_ROWS) {
    throw new AppError(
      "VALIDATION_FAILED",
      `Import up to ${String(MAX_IMPORT_ROWS)} guests at a time`,
      {
        fields: { file: `Split the file into parts of ${String(MAX_IMPORT_ROWS)} rows` },
      },
    );
  }
  const columns = mapHeader(header);
  if (columns.name === undefined) {
    throw new AppError("VALIDATION_FAILED", "The file needs a Name column", {
      fields: { file: "Add a column called Name (download the template to see the layout)" },
    });
  }

  const defaultSide = ownSide(ctx);
  const rows: ImportRow[] = [];
  const errors: ImportPreviewDto["errors"] = [];

  lines.forEach((cells, index) => {
    const line = index + 2;
    const cell = (column: Column) => {
      const at = columns[column];
      return at === undefined ? "" : (cells[at] ?? "").trim();
    };
    const problems: string[] = [];
    const tooLong = (value: string, max: number, label: string) => {
      if (value.length > max) problems.push(`${label} is longer than ${String(max)} characters`);
    };

    const name = cell("name");
    if (!name) problems.push("Name is missing");
    tooLong(name, 80, "Name");

    const rawPhone = cell("phone");
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    if (rawPhone && !phone) problems.push(`"${rawPhone}" isn't a phone number we recognise`);

    const rawEmail = cell("email").toLowerCase();
    if (rawEmail && !email.safeParse(rawEmail).success)
      problems.push(`"${rawEmail}" isn't an email address`);

    const rawSide = cell("side");
    const side = rawSide ? parseSide(rawSide) : defaultSide;
    if (!side)
      problems.push(
        rawSide ? `Side "${rawSide}" should be bride or groom` : "Side is missing (bride or groom)",
      );
    else if (defaultSide && side !== defaultSide)
      problems.push("You can only add guests on your own side");

    const rawMax = cell("maxHeadcount");
    const maxHeadcount = rawMax ? Number(rawMax) : null;
    if (
      maxHeadcount !== null &&
      !(Number.isInteger(maxHeadcount) && maxHeadcount >= 1 && maxHeadcount <= MAX_HEADCOUNT)
    ) {
      problems.push(`Headcount should be a number from 1 to ${String(MAX_HEADCOUNT)}`);
    }

    const household = cell("household") || name;
    tooLong(household, 80, "Household");
    const relation = cell("relation");
    tooLong(relation, 80, "Relation");
    const group = cell("group");
    tooLong(group, 60, "Group");
    const notes = cell("notes");
    tooLong(notes, 1000, "Notes");

    if (problems.length > 0 || !side) {
      errors.push({ line, message: problems.join("; ") });
      return;
    }
    rows.push({
      line,
      household,
      name,
      phone,
      email: rawEmail || null,
      side,
      relation: relation || null,
      group: group || null,
      maxHeadcount,
      isChild: TRUTHY.has(cell("isChild").toLowerCase()),
      notes: notes || null,
    });
  });

  // Duplicates are flagged, not dropped: two relatives can share a phone.
  const duplicates: ImportPreviewDto["duplicates"] = [];
  const existing = new Map(
    (
      await repo.findGuestsByPhone(ctx.wedding.id, [
        ...new Set(rows.flatMap((r) => (r.phone ? [r.phone] : []))),
      ])
    ).map((g) => [g.phone, g.name]),
  );
  const seen = new Map<string, number>();
  for (const row of rows) {
    if (!row.phone) continue;
    const already = existing.get(row.phone);
    const earlier = seen.get(row.phone);
    if (already) duplicates.push({ line: row.line, phone: row.phone, existing: already });
    else if (earlier !== undefined)
      duplicates.push({ line: row.line, phone: row.phone, existing: `line ${String(earlier)}` });
    else seen.set(row.phone, row.line);
  }

  return { rows, errors, duplicates, households: new Set(rows.map(householdKey)).size };
}

/** Saves the previewed rows as households and guests, all or nothing. */
export async function commitImport(
  ctx: GuestContext,
  rows: ImportRow[],
  eventIds: string[],
  events: EventInfo[],
): Promise<ImportResultDto> {
  if (!can(ctx.membership.role, "guests.edit")) throw forbidden();
  const known = new Set(events.map((e) => e.id));
  if (eventIds.some((id) => !known.has(id))) {
    throw new AppError("VALIDATION_FAILED", "Choose events from this wedding", {
      fields: { eventIds: "Choose events from this wedding" },
    });
  }
  const side = ownSide(ctx);
  if (side && rows.some((r) => r.side !== side)) {
    throw new AppError("FORBIDDEN", "You can only add guests on your own side");
  }

  const groups = Map.groupBy(rows, householdKey);
  const importBatchId = crypto.randomUUID();
  const prepared = [...groups.values()].map((members) => {
    const first = members[0];
    if (!first) throw new Error("Empty household group");
    if (members.length > MAX_HEADCOUNT) {
      throw new AppError(
        "VALIDATION_FAILED",
        `${first.household} has more than ${String(MAX_HEADCOUNT)} guests`,
        {
          fields: { rows: `Split ${first.household} into smaller households` },
        },
      );
    }
    const declared = members.flatMap((m) => (m.maxHeadcount ? [m.maxHeadcount] : []));
    return prepareHousehold(
      ctx,
      {
        name: first.household,
        side: first.side,
        group: members.find((m) => m.group)?.group ?? null,
        maxHeadcount: declared.length > 0 ? Math.max(...declared) : members.length,
        invitedEventIds: eventIds,
        notes: members.find((m) => m.notes)?.notes ?? null,
        guests: members.map((m) => ({
          name: m.name,
          phone: m.phone,
          email: m.email,
          relation: m.relation,
          isChild: m.isChild,
        })),
      },
      importBatchId,
    );
  });

  const households = prepared.map((p) => p.household);
  const guests = prepared.flatMap((p) => p.guests);
  const firstId = households[0]?.id;
  if (!firstId) throw new AppError("VALIDATION_FAILED", "There are no guests to import");
  await withTransaction(async (session) => {
    await repo.insertHouseholds(ctx.wedding.id, households, session);
    await repo.insertGuests(ctx.wedding.id, guests, session);
    await logActivity(
      {
        weddingId: ctx.wedding.id,
        actorId: ctx.user.id,
        actorLabel: ctx.user.name,
        action: "created",
        entity: "household",
        entityId: firstId,
        summary: `${ctx.user.name} imported ${String(guests.length)} guests in ${String(households.length)} households`,
      },
      session,
    );
  });
  return { importBatchId, households: households.length, guests: guests.length };
}

/** Removes an import's households, guests and answers within 24 hours of importing. */
export async function undoImport(
  ctx: GuestContext,
  importBatchId: string,
): Promise<{ households: number }> {
  if (!can(ctx.membership.role, "guests.edit")) throw forbidden();
  const households = await repo.findBatchHouseholds(ctx.wedding.id, importBatchId);
  const side = ownSide(ctx);
  const first = households[0];
  if (!first || (side && households.some((h) => h.side !== side)))
    throw notFound("Import not found");
  if (Date.now() - new Date(first.createdAt).getTime() > UNDO_WINDOW_HOURS * 3_600_000) {
    throw new AppError(
      "CONFLICT",
      `Imports can only be undone for ${String(UNDO_WINDOW_HOURS)} hours`,
    );
  }
  const removed = await withTransaction(async (session) => {
    const count = await repo.deleteBatch(
      ctx.wedding.id,
      households.map((h) => h.id),
      session,
    );
    await logActivity(
      {
        weddingId: ctx.wedding.id,
        actorId: ctx.user.id,
        actorLabel: ctx.user.name,
        action: "deleted",
        entity: "household",
        entityId: first.id,
        summary: `${ctx.user.name} undid an import of ${String(count)} households`,
      },
      session,
    );
    return count;
  });
  return { households: removed };
}
