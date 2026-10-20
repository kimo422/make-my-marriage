import { pingDb } from "@/lib/db/connect";
import { ok, route } from "@/lib/http";

// Liveness for uptime checks. R2 reachability joins this check in Phase 5.
export const GET = route(async (_request, { log }) => {
  try {
    await pingDb();
    return ok({ status: "ok", checks: { mongo: "ok" } });
  } catch (error) {
    log.error({ err: error }, "health check failed");
    return ok({ status: "degraded", checks: { mongo: "error" } }, { status: 503 });
  }
});
