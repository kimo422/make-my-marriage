@AGENTS.md

# Make My Marriage

Wedding-planning web app for Indian families: one Next.js 16 modular monolith (App Router,
strict TypeScript) on Vercel `bom1`, MongoDB Atlas via Mongoose, Better Auth, Resend,
Cloudflare R2. Design docs are in `docs/`; where they disagree, Database Design wins on data
and API Design wins on endpoints, except for the decisions below.

## Commands

- **npm only** — never pnpm or yarn.
- `npm run check` — lint, format check, typecheck, tests. Run before every commit.
- `npm test` — Vitest on an in-memory MongoDB replica set (transactions work; never touches Atlas).
- `npm run build` — needs `APP_URL` and `MONGODB_URI` set (env is validated in `next.config.ts`).
- `npm run db:migrate:create -- <name>` — indexes are built by migrations only (`autoIndex` is off).

## Architecture rules

- Feature code lives in `src/modules/<name>/`, layered as schema, types, model, repo, service
  and handlers; see `src/modules/README.md`. ESLint enforces the boundaries.
- `src/app/api/**/route.ts` only re-exports from a module's `handlers.ts`.
- Every handler is wrapped in `route()` from `@/lib/http`; parse input with `parseJson`,
  `parseQuery` and `parseParams`; return `ok`, `created`, `list` or `noContent`.
- Expected failures throw `AppError` with a code from `src/lib/errors` — don't invent new codes
  without adding them there and to the API Design.
- Wedding-scoped access goes through `requireAccess(user, weddingId, permission)` from
  `@/modules/weddings` (404 for strangers and deleted weddings, 403 for a missing permission).
  Permissions live in `src/modules/members/permissions.ts`. Weddings is the hub module: it may
  import members and activity, never the reverse.
- Every tenant collection applies `tenantGuard`; every repo method takes a `weddingId`.
  Cross-tenant lookups (token links, cron) must use `{ tenantScope: "global" }` explicitly.
- Multi-document writes that must agree go through `withTransaction`.
- Server-only files start with `import "server-only";`. Zod schemas in `schema.ts` stay
  client-safe (no mongoose).
- Never log guest phone numbers, emails, tokens or request bodies.

## Decisions that override the docs

- Email verification is **off**. Member invites are **shareable links only** — no invite email.
- URLs: public website `/site/[slug]`, guest RSVP `/r/[token]`, guest gallery `/g/[token]`,
  dashboard `/weddings/[weddingId]`.
- Uploads: 15 MB per file, 10 files per request; HEIC is converted to JPEG **in the browser**
  (sharp's prebuilt binaries can't decode HEVC HEIC).
- Organizers can create and edit any task; viewers see RSVP counts but not guest phones or emails.
- **No custom domain.** The app runs on `*.vercel.app`, the image Worker on `*.workers.dev`,
  and Resend can only email the account owner. Don't propose buying a domain.
- Message templates: one set per wedding (invite, reminder, event day). Starter checklists are
  hard-coded with relative due offsets. The invite card is generated with `next/og`. `.ics` covers
  attending events only.
- Production deploys run from GitHub Actions after migrations, not from Vercel's Git integration.

## Workflow

- Build in the phases agreed in planning; finish one, then wait for the user's go-ahead before
  starting the next. Phases 0–3 (scaffold, auth, weddings and members, events and tasks) are
  done; Phase 4 is guests, households, RSVP and WhatsApp invites.
- At the end of each phase, update `docs/Project Status.md`: what was built, what changed or was
  left out, the test count and the date.
- Conventional Commits (`feat:`, `fix:`, `chore:`, `ci:` …), enforced by a commit-msg hook.
- Short-lived `feat/*`, `fix/*` or `chore/*` branches, squash-merged into `main` once CI passes.
- New tenant routes need tests for each role (owner, manager, organizer, viewer) and a
  non-member, including an attempt to use another wedding's ids.
