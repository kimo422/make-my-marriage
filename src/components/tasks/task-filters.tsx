"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/cn";

interface Option {
  value: string;
  label: string;
}

/** Filters live in the URL, so a filtered view can be bookmarked or shared in the family group. */
export function TaskFilters({ members, events }: { members: Option[]; events: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const view = params.get("view") === "list" ? "list" : "board";
  const pill = (active: boolean) =>
    cn(
      "h-9 rounded-full px-4 text-sm font-medium whitespace-nowrap",
      active ? "bg-emerald text-ivory" : "border-hairline border bg-white hover:bg-stone",
    );
  const select = "border-hairline h-9 max-w-[11rem] rounded-full border bg-white px-3 text-sm";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="View">
        <button
          type="button"
          aria-pressed={view === "board"}
          className={pill(view === "board")}
          onClick={() => {
            set("view", null);
          }}
        >
          Board
        </button>
        <button
          type="button"
          aria-pressed={view === "list"}
          className={pill(view === "list")}
          onClick={() => {
            set("view", "list");
          }}
        >
          List
        </button>
        <span className="bg-hairline mx-1 w-px" aria-hidden="true" />
        <button
          type="button"
          aria-pressed={params.get("assignee") === "me"}
          className={pill(params.get("assignee") === "me")}
          onClick={() => {
            set("assignee", params.get("assignee") === "me" ? null : "me");
          }}
        >
          My tasks
        </button>
        <button
          type="button"
          aria-pressed={params.get("overdue") === "true"}
          className={pill(params.get("overdue") === "true")}
          onClick={() => {
            set("overdue", params.get("overdue") === "true" ? null : "true");
          }}
        >
          Overdue
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="filter-event">
          Event
        </label>
        <select
          id="filter-event"
          className={select}
          value={params.get("event") ?? ""}
          onChange={(e) => {
            set("event", e.target.value || null);
          }}
        >
          <option value="">All events</option>
          {events.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="filter-assignee">
          Assigned to
        </label>
        <select
          id="filter-assignee"
          className={select}
          value={params.get("assignee") === "me" ? "" : (params.get("assignee") ?? "")}
          onChange={(e) => {
            set("assignee", e.target.value || null);
          }}
        >
          <option value="">Anyone</option>
          {members.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
