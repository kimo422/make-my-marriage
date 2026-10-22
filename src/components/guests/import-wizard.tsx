"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ArchCard } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/form-alert";
import { api } from "@/lib/api-client";
import { formatPhone } from "@/lib/phone";
import { HOUSEHOLD_SIDE_LABELS } from "@/modules/guests/schema";
import type { ImportPreviewDto, ImportResultDto } from "@/modules/guests/types";

const TEMPLATE = [
  "Household,Name,Phone,Email,Side,Relation,Group,Seats,Child,Notes",
  "Sharma family,Ramesh Sharma,98765 43210,,Bride,Mama ji,Family,4,,",
  "Sharma family,Anu Sharma,,,Bride,,Family,,yes,",
  "Reddy family,Suresh Reddy,+91 90000 00001,suresh@example.com,Groom,Friend,College,2,,Vegetarian",
].join("\n");

const MAX_BYTES = 2 * 1024 * 1024;

interface Props {
  weddingId: string;
  events: { id: string; name: string }[];
}

export function ImportWizard({ weddingId, events }: Props) {
  const router = useRouter();
  const [preview, setPreview] = useState<ImportPreviewDto | null>(null);
  const [eventIds, setEventIds] = useState<string[]>(events.map((e) => e.id));
  const [result, setResult] = useState<ImportResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const base = `/api/weddings/${weddingId}/guests/import`;

  async function run(fn: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("That file is larger than 2 MB. Split it into smaller files.");
      return;
    }
    const form = new FormData();
    form.set("file", file);
    void run(async () => {
      setPreview(await api<ImportPreviewDto>("POST", `${base}/preview`, form));
    });
  }

  if (result) {
    return (
      <ArchCard className="space-y-4 text-center">
        <p className="font-serif text-3xl">Imported</p>
        <p>
          {result.guests} guests in {result.households} families are on your list.
        </p>
        {error ? <FormAlert>{error}</FormAlert> : null}
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href={`/weddings/${weddingId}/guests`}
            className="bg-emerald text-ivory hover:bg-emerald-hover inline-flex h-11 items-center rounded-full px-5 font-medium"
          >
            See the guest list
          </Link>
          <Button
            variant="secondary"
            className="h-11 w-auto"
            disabled={busy}
            onClick={() => {
              if (!window.confirm("Remove everything this import added?")) return;
              void run(async () => {
                await api("DELETE", `${base}/${result.importBatchId}`);
                setResult(null);
                setPreview(null);
                router.refresh();
              });
            }}
          >
            Undo this import
          </Button>
        </div>
        <p className="text-ink-muted text-sm">You can undo it from here for the next 24 hours.</p>
      </ArchCard>
    );
  }

  return (
    <div className="space-y-5">
      {error ? <FormAlert>{error}</FormAlert> : null}
      <ArchCard className="space-y-4">
        <h2 className="font-serif text-xl">1. Choose your file</h2>
        <p className="text-ink-muted text-sm">
          A CSV from Excel or Google Sheets (File → Download → CSV). Only <b>Name</b> is required;
          rows with the same Household are invited together. Side is Bride or Groom.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="bg-emerald text-ivory hover:bg-emerald-hover inline-flex h-11 cursor-pointer items-center rounded-full px-5 font-medium">
            {busy && !preview ? "Reading…" : preview ? "Choose another file" : "Choose CSV file"}
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
            download="guest-list-template.csv"
            className="text-emerald text-sm font-medium underline underline-offset-2"
          >
            Download a template
          </a>
        </div>
      </ArchCard>

      {preview ? (
        <>
          <ArchCard className="space-y-4">
            <h2 className="font-serif text-xl">2. Check what we found</h2>
            <p>
              <b>{preview.rows.length}</b> guests in <b>{preview.households}</b> families are ready.
              {preview.errors.length ? (
                <>
                  {" "}
                  <b className="text-danger">{preview.errors.length}</b>{" "}
                  {preview.errors.length === 1
                    ? "row has a problem and will"
                    : "rows have problems and will"}{" "}
                  be skipped.
                </>
              ) : null}
            </p>
            {preview.errors.length ? (
              <details open className="bg-stone/50 rounded-field p-4">
                <summary className="cursor-pointer font-medium">Rows with problems</summary>
                <ul className="mt-2 space-y-1 text-sm">
                  {preview.errors.slice(0, 50).map((e) => (
                    <li key={e.line}>
                      Line {e.line}: {e.message}
                    </li>
                  ))}
                </ul>
                <p className="text-ink-muted mt-2 text-sm">
                  Fix them in your sheet and choose the file again, or import the rest now.
                </p>
              </details>
            ) : null}
            {preview.duplicates.length ? (
              <details className="bg-blush/40 rounded-field p-4">
                <summary className="cursor-pointer font-medium">
                  {preview.duplicates.length} phone numbers appear more than once
                </summary>
                <ul className="mt-2 space-y-1 text-sm">
                  {preview.duplicates.slice(0, 50).map((d) => (
                    <li key={d.line}>
                      Line {d.line}: {formatPhone(d.phone)} is also {d.existing}
                    </li>
                  ))}
                </ul>
                <p className="text-ink-muted mt-2 text-sm">
                  They&apos;ll still be imported; relatives often share a phone.
                </p>
              </details>
            ) : null}
            <div className="border-hairline max-h-80 overflow-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone sticky top-0">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Family</th>
                    <th className="px-3 py-2 font-semibold">Guest</th>
                    <th className="px-3 py-2 font-semibold">Side</th>
                    <th className="px-3 py-2 font-semibold">Phone</th>
                  </tr>
                </thead>
                <tbody className="divide-hairline divide-y">
                  {preview.rows.slice(0, 200).map((r) => (
                    <tr key={r.line}>
                      <td className="px-3 py-2">{r.household}</td>
                      <td className="px-3 py-2">
                        {r.name}
                        {r.isChild ? <span className="text-ink-muted"> (child)</span> : null}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {HOUSEHOLD_SIDE_LABELS[r.side]}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.phone ? formatPhone(r.phone) : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ArchCard>

          <ArchCard className="space-y-4">
            <h2 className="font-serif text-xl">3. Invite them to</h2>
            {events.length === 0 ? (
              <p className="text-ink-muted text-sm">
                No events yet. You can import now and choose events for each family later.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {events.map((ev) => (
                  <label
                    key={ev.id}
                    className="border-hairline bg-field has-checked:border-emerald has-checked:bg-emerald-soft rounded-field flex cursor-pointer items-center gap-3 border px-4 py-3"
                  >
                    <input
                      type="checkbox"
                      className="accent-emerald size-4"
                      checked={eventIds.includes(ev.id)}
                      onChange={(e) => {
                        setEventIds((list) =>
                          e.target.checked ? [...list, ev.id] : list.filter((id) => id !== ev.id),
                        );
                      }}
                    />
                    <span className="font-medium">{ev.name}</span>
                  </label>
                ))}
              </div>
            )}
            <Button
              className="sm:w-auto"
              disabled={busy || preview.rows.length === 0}
              onClick={() => {
                void run(async () => {
                  setResult(
                    await api<ImportResultDto>("POST", base, { rows: preview.rows, eventIds }),
                  );
                  router.refresh();
                });
              }}
            >
              {busy ? "Importing…" : `Import ${String(preview.rows.length)} guests`}
            </Button>
          </ArchCard>
        </>
      ) : null}
    </div>
  );
}
