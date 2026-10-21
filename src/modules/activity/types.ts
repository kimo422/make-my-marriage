// Client-safe activity feed types.

export type ActivityAction =
  | "created"
  | "updated"
  | "deleted"
  | "invited"
  | "rsvped"
  | "uploaded"
  | "moderated"
  | "regenerated_link";

export type ActivityEntity =
  "wedding" | "event" | "task" | "household" | "guest" | "member" | "photo" | "gallery";

export interface ActivityDto {
  id: string;
  actorLabel: string;
  action: ActivityAction;
  entity: ActivityEntity;
  entityId: string;
  summary: string;
  at: string;
}
