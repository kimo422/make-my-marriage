import type { Priority, TaskStatus } from "./schema";

// Client-safe task DTOs. dueAt is "YYYY-MM-DD".

export interface TaskDto {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string | null;
  eventId: string | null;
  dueAt: string | null;
  boardOrder: number;
  createdBy: string;
  completedAt: string | null;
  updatedAt: string;
  /** Not done and due before today in the wedding's time zone. */
  overdue: boolean;
}

export interface TaskCountsDto {
  todo: number;
  in_progress: number;
  done: number;
  overdue: number;
}
