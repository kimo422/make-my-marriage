"use client";

import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import { ArchCard } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { SelectField } from "@/components/ui/select-field";
import { api, ApiClientError } from "@/lib/api-client";
import { PRIORITIES, PRIORITY_LABELS, STATUS_LABELS, TASK_STATUSES } from "@/modules/tasks/schema";
import type { TaskDto } from "@/modules/tasks/types";

export interface Option {
  value: string;
  label: string;
}

interface Props {
  weddingId: string;
  task?: TaskDto;
  members: Option[];
  events: Option[];
  /** Preselects an event when adding a task from that event. */
  defaultEventId?: string | undefined;
  /** Shows Delete (managers, or the task's creator). */
  canDelete?: boolean;
}

export function TaskForm({
  weddingId,
  task,
  members,
  events,
  defaultEventId,
  canDelete = false,
}: Props) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const back = `/weddings/${weddingId}/tasks`;

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (key: string) => {
      const v = f.get(key);
      return typeof v === "string" ? v.trim() : "";
    };
    const body = {
      title: text("title"),
      description: text("description"),
      status: text("status"),
      priority: text("priority"),
      assigneeId: text("assigneeId"),
      eventId: text("eventId"),
      dueAt: text("dueAt"),
    };
    if (!body.title) {
      setFieldErrors({ title: "Give the task a title" });
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setPending(true);
    try {
      if (task) await api("PATCH", `/api/weddings/${weddingId}/tasks/${task.id}`, body);
      else await api("POST", `/api/weddings/${weddingId}/tasks`, body);
      router.push(back);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError && Object.keys(error.fields).length)
        setFieldErrors(error.fields);
      else setFormError(error instanceof Error ? error.message : "Couldn't save the task.");
      setPending(false);
    }
  }

  async function onDelete() {
    if (!task || !window.confirm(`Delete "${task.title}"?`)) return;
    setPending(true);
    try {
      await api("DELETE", `/api/weddings/${weddingId}/tasks/${task.id}`);
      router.push(back);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Couldn't delete the task.");
      setPending(false);
    }
  }

  const none = { value: "", label: "Nobody yet" };
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        void onSubmit(e);
      }}
    >
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <ArchCard className="space-y-5">
        <Field
          label="Task"
          name="title"
          defaultValue={task?.title ?? ""}
          placeholder="Book the mehendi artist"
          error={fieldErrors.title}
        />
        <div className="space-y-1.5">
          <label htmlFor="description" className="text-sm font-semibold">
            Details (optional)
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={2000}
            defaultValue={task?.description ?? ""}
            className="rounded-field border-hairline bg-field focus:border-emerald focus:ring-emerald/15 w-full border px-4 py-3 focus:ring-2 focus:outline-none"
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            label="Who's doing it"
            name="assigneeId"
            defaultValue={task?.assigneeId ?? ""}
            options={[none, ...members]}
            error={fieldErrors.assigneeId}
          />
          <Field
            label="Due (optional)"
            name="dueAt"
            type="date"
            defaultValue={task?.dueAt ?? ""}
            error={fieldErrors.dueAt}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <SelectField
            label="Event (optional)"
            name="eventId"
            defaultValue={task?.eventId ?? defaultEventId ?? ""}
            options={[{ value: "", label: "Whole wedding" }, ...events]}
            error={fieldErrors.eventId}
          />
          <SelectField
            label="Status"
            name="status"
            defaultValue={task?.status ?? "todo"}
            options={TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          />
          <SelectField
            label="Priority"
            name="priority"
            defaultValue={task?.priority ?? "medium"}
            options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
          />
        </div>
      </ArchCard>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : task ? "Save task" : "Add task"}
      </Button>
      {task && canDelete ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            void onDelete();
          }}
          className="text-ink-muted hover:text-ink w-full text-center text-sm underline underline-offset-4"
        >
          Delete this task
        </button>
      ) : null}
    </form>
  );
}
