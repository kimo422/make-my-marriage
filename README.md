# Make My Marriage

A web app where an Indian family plans the whole wedding in one place: events, tasks,
organizers, guests with per-event RSVP, a wedding website and a shared photo gallery.

Design docs live in [`docs/`](docs): PRD, System Design, Database Design and API Design.

**Stack:** Next.js 16 (App Router, TypeScript strict) · MongoDB Atlas + Mongoose · Better Auth
(email and password) · Resend · Cloudflare R2 · Vercel (Mumbai, `bom1`).

## Getting started

Requirements: Node 24 (`.nvmrc`) and npm 11.

```bash
npm install                 # also installs the git hooks
cp .env.example .env.local  # then fill in the values
npm run dev                 # http://localhost:3000
```

Every environment variable is validated at startup ([`src/lib/env/schema.ts`](src/lib/env/schema.ts)),
so a missing value stops `next dev` and `next build` with a list of what's wrong.

Check that the app can reach MongoDB: `curl http://localhost:3000/api/health`.

Create the database indexes once per database: `npm run db:migrate`.

## Scripts

| Script                                     | What it does                                               |
| ------------------------------------------ | ---------------------------------------------------------- |
| `npm run dev`                              | Dev server                                                 |
| `npm run build` / `npm start`              | Production build and server                                |
| `npm run check`                            | Everything CI runs except the build                        |
| `npm run lint` / `lint:fix`                | ESLint, including the module boundary rules                |
| `npm run format` / `format:check`          | Prettier                                                   |
| `npm run typecheck`                        | Generates Next.js route types, then `tsc --noEmit`         |
| `npm test` / `test:watch`                  | Vitest against an in-memory MongoDB replica set (no Atlas) |
| `npm run db:migrate` / `db:migrate:status` | Apply or list migrations (indexes and data changes)        |
| `npm run db:migrate:create -- <name>`      | New migration in `migrations/`                             |

The first `npm test` downloads a MongoDB binary (about 100 MB), which can take a minute.

## Project structure

```
src/
  app/              pages and route handlers (api/**/route.ts only re-export module handlers)
  modules/          feature modules: schema, types, model, repo, service, handlers
  lib/
    env/            Zod-validated environment
    db/             cached connection, tenant guard, transactions
    http/           route() wrapper, body/query/param parsing, response helpers
    errors/         AppError and the API's error codes
    validation/     shared Zod pieces (objectId, cursor paging, operator-key stripping)
    logger/         pino with redaction
    types/          API envelope types
tests/              API tests, helpers and the in-memory MongoDB setup
migrations/         migrate-mongo scripts
docs/               design docs
```

Module rules are in [`src/modules/README.md`](src/modules/README.md). In short: modules talk
through each other's index, only repos touch mongoose, and every tenant query names a `weddingId`.
The [tenant guard](src/lib/db/tenant-guard.ts) rejects queries that don't.

## Conventions

- **API responses:** `{ data }`, `{ data, page: { nextCursor } }` or
  `{ error: { code, message, fields? } }`. Codes are in [`src/lib/errors`](src/lib/errors/index.ts).
- **Mutations** must come from the app's own origin (checked in `route()`).
- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`,
  `chore:` …), checked by a commit-msg hook and in CI.
- **Branches:** `main` is always deployable. Work on short-lived `feat/*`, `fix/*` or `chore/*`
  branches, open a pull request, and squash-merge once CI passes.

## Accounts and settings to set up

Nothing below costs money. No custom domain is used: the app runs on `*.vercel.app` and, from
Phase 5, the image Worker on `*.workers.dev`.

| When    | Service       | What to create                                                                                     | Env vars                       |
| ------- | ------------- | -------------------------------------------------------------------------------------------------- | ------------------------------ |
| Now     | MongoDB Atlas | Free M0 cluster in Mumbai (ap-south-1); a database user limited to `mmm`; network access 0.0.0.0/0 | `MONGODB_URI`, `MONGODB_DB`    |
| Now     | Vercel        | Import this GitHub repo as a project; Node 24; region `bom1` comes from `vercel.json`              | `APP_URL` and the vars above   |
| Now     | (none)        | A random `BETTER_AUTH_SECRET` of 32+ characters per environment (see `.env.example`)               | `BETTER_AUTH_SECRET`           |
| Phase 4 | (none)        | A random `TOKEN_SECRET` of 32+ characters per environment; never change it once links are sent     | `TOKEN_SECRET`                 |
| Phase 1 | Resend        | Account and API key. Without a verified domain it only delivers to your own address                | `RESEND_API_KEY`, `EMAIL_FROM` |
| Phase 5 | Cloudflare    | R2 buckets (dev and prod), an R2 API token, a Worker on `workers.dev`                              | `R2_*`, `IMAGE_BASE_URL`, …    |

## GitHub settings (one-time)

1. **Branch protection** (Settings → Branches → Add rule for `main`): require a pull request,
   require the **Lint, types, tests, build** check to pass, and allow squash merging only
   (Settings → General → Pull Requests).
2. **Deploying** (Settings → Secrets and variables → Actions):
   See "Deploying" below. Until the variable `DEPLOY_ENABLED` is `true`, the deploy workflow
   skips itself.

## Deploying

Pull requests get a Vercel preview automatically. Vercel's own deploys from `main` are turned off
in `vercel.json`. Instead, when CI passes on `main`, the
[deploy workflow](.github/workflows/deploy.yml) runs migrations, deploys to production, then
checks `/api/health`, so the database is always ready before new code goes live.

### First production launch (one-time)

1. **Atlas: production database.** On the same free cluster, add a database user (Database
   Access) with **readWrite on `mmm` only** and a long generated password. Production uses the
   database `mmm`; development keeps `mmm_dev`. Network Access must allow `0.0.0.0/0`, because
   Vercel functions and GitHub runners have no fixed IP addresses. Copy the `mongodb+srv://`
   connection string for this user.
2. **Vercel: Production environment variables** (Project → Settings → Environment Variables,
   tick only **Production**). Use new secrets here, not the development ones.

   | Variable             | Value                                                      |
   | -------------------- | ---------------------------------------------------------- |
   | `APP_URL`            | `https://make-my-marriage.vercel.app` (no trailing slash)  |
   | `MONGODB_URI`        | the production connection string from step 1               |
   | `MONGODB_DB`         | `mmm`                                                      |
   | `BETTER_AUTH_SECRET` | a new random value (32+ characters)                        |
   | `TOKEN_SECRET`       | a new random value (32+ characters); never change it later |
   | `LOG_LEVEL`          | `info`                                                     |
   | `RESEND_API_KEY`     | optional; without a domain it only emails your own address |

   Generate each secret with
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

3. **Vercel: token and ids.** Create a token (Account Settings → Tokens, scope: your team or
   account). The team id is under Team Settings → General ("Team ID"; for a personal account,
   Account Settings → General, "Vercel ID"); the project id is under Project → Settings → General
   ("Project ID").
4. **GitHub: secrets and switch** (repo → Settings → Secrets and variables → Actions):
   - Secrets, in the **`make-my-marriage`** environment (or as repository secrets):
     `VERCEL_TOKEN`, `VERCEL_ORG_ID` (team or account id), `VERCEL_PROJECT_ID`, `MONGODB_URI`
     (the production string from step 1; the workflow runs migrations with it).
   - Variable `MONGODB_DB` = `mmm` (environment or repository).
   - **Repository** variable `DEPLOY_ENABLED` = `true`. It must be at repository level: the
     workflow decides whether to run before it loads the environment.
5. **Deploy.** Actions → **Deploy production** → Run workflow (or merge anything to `main`).
   The run migrates `mmm`, deploys, and passes only when
   `https://make-my-marriage.vercel.app/api/health` reports `ok`.

### If a deploy goes wrong

- The "Check deploy settings" step names any missing secret.
- A build error naming `APP_URL` means the Production `APP_URL` isn't the https site address.
- If the health check fails, open the deployment's logs in Vercel. To roll back, promote the
  previous production deployment in Vercel (Deployments → ⋯ → Promote). Migrations only add
  indexes, so the older code still works with them.
