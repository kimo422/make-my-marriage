import type {
  Aggregate,
  MongooseDefaultQueryMiddleware,
  PipelineStage,
  Query,
  Schema,
} from "mongoose";

// Every tenant collection carries a weddingId. This plugin rejects any query on
// such a collection whose filter does not name one, so a missing tenant filter
// fails loudly in tests instead of leaking another wedding's data.
//
// Lookups that run before the wedding is known (guest token links, the daily
// cron) opt out explicitly and visibly:
//   Model.findOne({ rsvpTokenHash }).setOptions({ tenantScope: "global" })
//   Model.aggregate(pipeline).option({ tenantScope: "global" })

declare module "mongoose" {
  interface QueryOptions {
    tenantScope?: "global";
  }
}

export class TenantScopeError extends Error {
  constructor(model: string, operation: string) {
    super(
      `${model}.${operation}() ran without a weddingId filter. ` +
        `Pass weddingId, or set { tenantScope: "global" } for a deliberate cross-tenant lookup.`,
    );
    this.name = "TenantScopeError";
  }
}

const guardedQueries: MongooseDefaultQueryMiddleware[] = [
  "countDocuments",
  "deleteMany",
  "deleteOne",
  "distinct",
  "estimatedDocumentCount",
  "find",
  "findOne",
  "findOneAndDelete",
  "findOneAndReplace",
  "findOneAndUpdate",
  "replaceOne",
  "updateMany",
  "updateOne",
];

function hasWeddingId(filter: Record<string, unknown>): boolean {
  return filter.weddingId !== undefined && filter.weddingId !== null;
}

export function tenantGuard(schema: Schema): void {
  // updateOne and deleteOne are also document hooks; register on queries only.
  schema.pre<Query<unknown, unknown>>(
    guardedQueries,
    { document: false, query: true },
    function () {
      if (this.getOptions().tenantScope === "global") return;
      if (!hasWeddingId(this.getFilter())) {
        const op = (this as { op?: string }).op ?? "query";
        throw new TenantScopeError(this.model.modelName, op);
      }
    },
  );

  schema.pre("aggregate", function (this: Aggregate<unknown>) {
    if ((this.options as { tenantScope?: string }).tenantScope === "global") return;
    const first: PipelineStage | undefined = this.pipeline()[0];
    const match = first && "$match" in first ? (first.$match as Record<string, unknown>) : null;
    if (!match || !hasWeddingId(match)) {
      throw new TenantScopeError(this.model().modelName, "aggregate");
    }
  });
}
