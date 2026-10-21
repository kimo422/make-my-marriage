// The activity log has no dependencies, so any module can record to it.
export { listWeddingActivity, logActivity, type NewActivity } from "./service";
export type { ActivityDto } from "./types";
