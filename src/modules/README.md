# Feature modules

One folder per module: `auth`, `weddings`, `members`, `events`, `tasks`, `guests`,
`rsvp`, `invites`, `website`, `gallery`, `activity`. Each is added in the build phase
that needs it.

```
modules/<name>/
  schema.ts    Zod input schemas. Client-safe: shared by forms and handlers. No mongoose.
  types.ts     DTOs and response types (mostly z.infer). Client-safe.
  model.ts     Mongoose schema and indexes. Tenant schemas apply `tenantGuard`.
  repo.ts      The only code that touches the model. Every method takes a weddingId.
  service.ts   Business rules, permission and side checks, transactions.
  handlers.ts  Route handler functions, wrapped with `route()` from @/lib/http.
  index.ts     Public surface for other modules: the service and the types.
```

Rules (enforced by ESLint where possible):

- Another module is used only through `@/modules/<name>` (its index), or its
  `schema`/`types` files from client code. Never import its `model`, `repo` or `service` directly.
- Only `src/app/api/**/route.ts` imports `handlers`; each route file just re-exports, for example
  `export { GET, POST } from "@/modules/events/handlers";`.
- Only `src/lib/db`, `model.ts` and `repo.ts` import mongoose.
- Server-only files start with `import "server-only";`.
