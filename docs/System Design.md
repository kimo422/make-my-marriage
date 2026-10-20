# Make My Marriage — System Design

Oct 17, 2026 · @Krishna Mohan P

## Summary and key decisions

Make My Marriage is **one Next.js application** deployed on Vercel, with pages and API in a single codebase. Data lives in MongoDB Atlas and photos in Cloudflare R2. Every piece runs on a free tier and sits close to Indian users: Vercel functions in Mumbai, Atlas in Mumbai and R2 with an Asia-Pacific location hint.

This design replaces the separate React SPA plus Express API sketched in the PRD. One codebase and one deploy is simpler to build alone, and it still demonstrates clean module boundaries.

| Area | Decision | Why it fits |
| --- | --- | --- |
| Architecture | Modular monolith | One deployable; modules can be split out later if needed |
| Framework | Next.js (App Router) with TypeScript | Server-rendered guest pages load fast on phones; one language end to end |
| Runtime | Node.js LTS (Vercel Node runtime) | Required by Next.js and by `sharp` for image processing |
| Hosting | Vercel Hobby, functions in Mumbai (`bom1`) | Free for a personal portfolio; automatic previews per pull request |
| Database | MongoDB Atlas free cluster (M0), Mumbai | Managed replica set; flexible documents suit events and RSVPs |
| ODM and validation | Mongoose + Zod | Schemas in the database layer, strict input checks at the edge |
| Photo storage | Cloudflare R2, private bucket | 10 GB free, no egress fees, S3-compatible API |
| Photo delivery | Cloudflare Worker + CDN on an image subdomain | Verifies signed links, caches photos near guests, keeps the bucket private |
| Auth | Better Auth, email and password, no email verification | Proven hashing and sessions; guests never need accounts |
| Email | Resend | Free plan covers password reset and member invites |
| Async work | Inline in API routes + Vercel Cron | No worker process needed on Vercel |
| CI/CD | GitHub Actions for checks; Vercel Git integration for deploys | Preview on every pull request, production on merge to `main` |

All choices are now confirmed except infrastructure as code (see Open decisions).

## Architecture overview

Browsers reach one Vercel deployment that serves pages and the API; slow work like photo processing runs inside API routes. Data lives in Atlas, photos in R2, and guests view photos through a Cloudflare Worker.

&#91;embedded content: system architecture · 1 Vercel app, 4 managed services\]

Photo bytes never pass through Vercel on upload: guests upload straight to R2 with a presigned link. R2 has no egress fees, so serving photos through the Worker costs nothing on the free tier.

## Application structure

The code is split into feature modules with strict layers. The rule is that a module calls another module only through its service, never by touching that module's models.

**Modules:** `auth`, `weddings`, `members`, `events`, `tasks`, `guests` (households, guests, CSV import), `rsvp`, `invites` (WhatsApp messages, message state), `website`, `gallery`.

**Layers inside each module**

1. **Route layer**: Next.js route handlers and pages. They parse input with Zod, resolve the session and call one service method.
2. **Service layer**: business rules and permission checks, for example "an Organizer can only edit guests on their side".
3. **Repository layer**: the only code that touches Mongoose models. Every query takes a `weddingId`.
4. **Model layer**: Mongoose schemas and indexes.

**Folder layout**

```
src/
  app/
    (dashboard)/w/[weddingId]/...   organizer pages
    (public)/site/[slug]/           wedding website
    (public)/r/[token]/             guest RSVP
    (public)/g/[token]/             guest gallery
    api/                            JSON route handlers
    api/cron/cleanup/               daily Vercel Cron job
  modules/
    weddings/  route.ts  service.ts  repo.ts  model.ts  schema.ts
    guests/    ...
    gallery/   ...  process-photo.ts
  lib/
    auth/  db/  r2/  email/  rbac/  rate-limit/  tokens/  errors/
worker-images/                      Cloudflare Worker for photo delivery
```

The Cloudflare Worker is the only code outside the Next.js app. It is a few dozen lines that verify a signed link and stream the photo from R2.

## Requests, auth and access control

Every request carries one of two identities: a **logged-in member** (session cookie) or a **guest token** (in the URL). Each request is checked against exactly one of them.

**Rendering**

| Surface | Rendering | Reason |
| --- | --- | --- |
| Guest RSVP, gallery, website | Server-rendered (React Server Components) | Fast first load on 4G; little JavaScript sent |
| Organizer dashboard | Server-rendered shell + client components with TanStack Query | Interactive boards, filters and live counts |
| Mutations | Route handlers under `/api` (JSON) | One clear REST surface to document and test; reused by the cron job |

**Authentication (members)**

- Email and password through Better Auth, configured with `requireEmailVerification: false`: a new account can log in immediately after sign-up.
- Passwords need at least 8 characters and are hashed by Better Auth (scrypt by default).
- Forgot password sends a reset link through Resend; the link expires in 1 hour. This is the only email a user receives about their own account.
- Sessions are stored in MongoDB and referenced by an `httpOnly`, `Secure`, `SameSite=Lax` cookie with a 30-day sliding expiry. Logout or a password change revokes them server-side.
- Without verification, a mistyped email can't be caught at sign-up. The account page shows the email prominently and lets the user change it; verification can be switched on later with one config flag.

**Authorization (roles)**

- A `requireMember(weddingId, permission)` guard runs first in every dashboard handler. It loads the membership and checks the permission against the PRD's role matrix (Owner, Wedding Manager, Organizer, Viewer).
- Side scoping (bride, groom or both) is enforced in the guests service, not in the UI.
- Roles map to named permissions such as `guests.edit`, `gallery.moderate` and `members.manage`, so a role change never needs code edits across handlers.

**Tenant isolation**

- Every repository method requires a `weddingId` argument, and every collection has a compound index starting with `weddingId`.
- A Mongoose plugin rejects any query on a tenant collection that lacks a `weddingId` filter, catching mistakes in tests.

**Guest tokens (no accounts)**

- RSVP and gallery tokens are derived, not random: base64url of HMAC-SHA256(TOKEN\_SECRET, record id + version). Only the SHA-256 hash is stored for lookup, and the link can be rebuilt on demand for WhatsApp messages and QR cards. Invite and device tokens are 32 random bytes.
- A `requireGuestToken(kind)` guard looks up the hash and returns the household or gallery scope. It never grants dashboard access.
- Regenerating a gallery link replaces the hash, so old QR codes stop working at once.
- The gallery PIN is hashed like a password. Five wrong attempts lock that browser out for 15 minutes.

## Data layer

MongoDB Atlas holds all application data in one database, `mmm`, with the collections from the PRD plus three added for this design.

**Cluster**

| Environment | Atlas tier | Region | Notes |
| --- | --- | --- | --- |
| Development | Free shared cluster (M0) | Mumbai (ap-south-1) | One cluster per developer or a shared dev database |
| Production demo | Free M0 to start; move to a dedicated tier when traffic or backups require it | Mumbai (ap-south-1) | Continuous backups and point-in-time restore need a dedicated tier |

Both clusters are three-node replica sets, so multi-document transactions are available. Vercel functions have no fixed outbound IP on the free plan, so Atlas network access allows all IPs. The connection is protected instead by TLS, a long random password, and a least-privilege database user limited to the `mmm` database.

**Collections added by this design**

| Collection | Purpose | Key indexes |
| --- | --- | --- |
| sessions | Better Auth login sessions | token (unique); TTL on expiresAt |
| uploads | Pending guest uploads awaiting confirmation | weddingId + createdAt; TTL after 1 day |
| rateLimits | Counters for login, RSVP and upload limits | key (unique); TTL on expiresAt |

**Modelling rules**

- Keep collections flat and reference by id (`weddingId`, `eventId`, `householdId`). Embed only small, bounded data such as a venue inside an event.
- `rsvps` stays a separate collection with one document per household per event. This keeps writes small and the per-event counts quick to aggregate.
- RSVP dashboard counts come from an aggregation pipeline grouped by `eventId`; it can be cached for 30 seconds per wedding if needed.
- Use transactions only where two writes must agree, for example accepting an invite (mark invite accepted plus create membership) or regenerating a gallery link (new hash plus activity log).
- Soft-delete photos (`status: removed`) and purge the R2 objects in a cleanup job, so a mistaken removal can be undone for 7 days.

**Connection handling**

- One Mongoose connection per function instance, cached on `globalThis` so warm invocations and Next.js hot reload reuse it.
- Keep `maxPoolSize` small (about 5), because many function instances may run at once and the free cluster caps total connections.

## Photo storage and upload pipeline

Guests scan a QR code at the venue and upload directly to a private R2 bucket with a short-lived presigned link. The API then cleans each photo before it appears.

&#91;embedded content: guest photo upload by QR code · 7 steps\]

Photo bytes reach Vercel only once, when the API fetches the original to process it. Uploads themselves go straight to R2, so a wedding-night rush doesn't hit Vercel's request size limits.

**QR code upload**

- Each wedding gets one gallery QR code, plus an optional QR code per event album (for example Sangeet or Reception) so photos land in the right album automatically.
- The QR code encodes the gallery link `https://<app>/g/<token>?album=<eventId>`. It is generated on the server with the `qrcode` package and offered to owners as a PNG and a printable A6 table card (couple's names, event, optional PIN).
- Scanning opens a mobile upload page with no login. It uses a large "Add photos" button (`<input type="file" accept="image/*" multiple>`) that lets guests pick from their gallery or open the camera. It shows per-photo progress and retries failed uploads.
- Uploads run 3 at a time from the browser, so a guest can select 50 photos and pocket the phone.
- Regenerating the gallery link invalidates every printed QR code at once; the dashboard warns the owner to reprint.
- If a PIN is set, the guest enters it once per browser; a signed cookie remembers it for 24 hours.
- The dashboard counts QR scans and uploads per album, so owners can see which tables are sharing.

**Bucket layout** (one private R2 bucket, public `r2.dev` access disabled)

| Prefix | Contents | Lifecycle |
| --- | --- | --- |
| `incoming/<weddingId>/<uploadId>` | Raw uploads awaiting processing | Deleted after 1 day |
| `originals/<weddingId>/<photoId>.jpg` | Re-encoded original, metadata stripped | Kept until wedding retention ends |
| `display/<weddingId>/<photoId>.webp` | 1600 px wide for viewing | Same as originals |
| `thumbs/<weddingId>/<photoId>.webp` | 400 px wide for the grid | Same as originals |

**Rules**

- The presigned PUT fixes the object key and content type (`image/jpeg`, `image/png`, `image/heic`) and expires in 5 minutes. R2 presigned links don't support form-style POST, so the 20 MB limit is checked on confirm: the API reads the object's size and deletes anything larger.
- On confirm, the API route (Node runtime) fetches the file, checks its real signature, auto-rotates, strips EXIF and GPS, converts HEIC, and writes the two smaller sizes with `sharp`. The photo shows as "processing" for a few seconds, then goes live.
- A failed or interrupted processing run leaves the photo in `processing`; the daily cron retries it.
- Delivery runs through a Cloudflare Worker on `img.<domain>`. The gallery page receives links signed with HMAC that expire after 1 hour. The Worker checks the signature, reads the object through its R2 binding, and returns it with long cache headers and `X-Robots-Tag: noindex`.
- CORS on the bucket allows PUT only from the app's domain.
- Each wedding has a storage quota, so the free 10 GB isn't used up by one wedding; the upload-slot endpoint refuses new slots once the quota is reached.

## Async and scheduled work

Vercel has no long-running worker. Each slow task either runs inside the API request that triggers it, runs in the browser, or runs on a daily Vercel Cron schedule.

| Task | Where it runs | What it does |
| --- | --- | --- |
| Process photo | Confirm-upload API route | Checks file bytes, strips EXIF and GPS, makes thumbnail and display sizes, marks photo live |
| "Download all" ZIP | Owner's browser | Fetches originals through the Worker and zips them on the device with a streaming ZIP library, so no server time limit applies |
| Send email | Inline in the API route via Resend | Password reset and member invites; one retry on failure |
| Cleanup | Vercel Cron, daily | Purges removed photos after 7 days, expired invites, stale uploads, and retries photos stuck in processing |
| Upload window | Same daily cron | Closes gallery uploads past the owner's end date |

The cron endpoint (`/api/cron/cleanup`) accepts only requests carrying Vercel's `CRON_SECRET` header. Each run processes a bounded batch, so it finishes well within the function time limit.

If processing load ever grows beyond what a request can handle, photo processing can move to a Cloudflare Queue consumer or a separate worker host without changing the upload flow.

## Security and privacy

The main risks are a guest link leaking and one wedding seeing another's data; the controls below target those first.

| Risk | Control |
| --- | --- |
| Cross-wedding data access | `weddingId` required in every repository call; Mongoose guard plugin; tests that try another wedding's ids |
| Leaked gallery QR code or RSVP link | Hashed tokens, link regeneration (invalidates printed QR codes), optional PIN, upload end date |
| Password attacks | Strong hashing, login rate limit (5 tries per 15 minutes per email and IP), generic error messages |
| Unverified email at sign-up | Rate-limit sign-ups per IP; no sensitive action relies on email ownership; member invites are accepted only by the invited address; verification can be enabled later |
| Session theft | `httpOnly` `Secure` cookies, server-side revocation, CSRF protection via `SameSite` plus an Origin header check on mutations |
| Malicious uploads | Presigned PUT with fixed key and type, size check on confirm, file signature check, re-encode with `sharp`, per-wedding storage quota |
| Location leakage in photos | EXIF and GPS stripped before any photo is shown |
| Public indexing | `noindex` meta on pages and `X-Robots-Tag` on Worker image responses |
| Injection and bad input | Zod validation on every handler; Mongoose `strictQuery`; strip `$` keys from user input |
| Secrets exposure | Secrets in Vercel and Cloudflare encrypted environment variables; never in the repo |
| Abuse of the open upload endpoint | Rate limit per token and IP; Cloudflare rate limiting rules on the image domain |

**Headers:** a strict Content Security Policy, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

**Privacy (DPDP Act):** collect only names, phone numbers and emails needed for invites. Show a privacy notice on guest pages, let owners delete a guest's data on request, and delete all wedding data on account deletion.

## Deployment, environments and CI/CD

Vercel builds and deploys the Next.js app from GitHub; the image Worker deploys to Cloudflare with `wrangler`. Every environment uses the same code, and only environment variables differ.

| Environment | App | Database | Photos |
| --- | --- | --- | --- |
| Local | `next dev` | Atlas dev cluster (or local MongoDB in Docker) | R2 dev bucket, or MinIO as an S3-compatible stand-in |
| Preview | Vercel preview deployment per pull request | Atlas dev cluster | R2 dev bucket |
| Production | Vercel Hobby, functions in `bom1` (Mumbai) | Atlas M0, Mumbai | R2 production bucket + image Worker |

**Vercel settings:** Node.js runtime for API routes that use `sharp` and Mongoose; function region `bom1`; one daily cron for `/api/cron/cleanup`. The Hobby plan is for personal, non-commercial use; moving to Pro is the step if this ever becomes a product.

**Pipeline**

1. On every pull request, GitHub Actions runs install, lint, type-check, unit tests and API tests against an in-memory MongoDB. Vercel builds a preview deployment.
2. On merge to `main`, Vercel deploys to production, and a GitHub Action deploys the image Worker with `wrangler deploy`.
3. Nightly, Playwright runs end-to-end tests for the four key PRD flows (including a QR-code upload) against production with a seeded demo wedding.

**Configuration:** `MONGODB_URI`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `IMAGE_BASE_URL`, `IMAGE_SIGNING_SECRET`, `CRON_SECRET`, TOKEN\_SECRET, `APP_URL`. Values live in Vercel and Cloudflare environment settings and are validated with Zod at startup, so a missing value fails the build instead of a request.

**Infrastructure as code (optional):** the R2 bucket, CORS rules, Worker route and DNS can be defined with the Cloudflare Terraform provider, and the Vercel project with the Vercel Terraform provider.

## Observability, performance and scaling

Vercel and Cloudflare scale automatically, so the free tiers handle the portfolio's expected load. The limits to watch are Atlas M0 connections and storage, and R2's 10 GB.

**Observability**

- Structured JSON logs with `pino`, including a request id, `weddingId` and user id (never guest phone numbers), visible in Vercel's runtime logs.
- Error tracking with Sentry's free plan for both the server and the browser.
- `/api/health` checks the MongoDB ping and R2 reachability.
- Basic counts on the dashboard: uploads and QR scans per album, photos stuck in processing, failed emails.

**Performance**

- Guest pages are server-rendered with minimal client JavaScript. The gallery loads thumbnails first and lazy-loads larger sizes as WebP from Cloudflare's cache.
- The website page (`/site/[slug]`) is cached and revalidated when an owner publishes a change.
- Indexes from the PRD data model cover every list query; check slow queries with Atlas Performance Advisor.

**Scaling path (only when needed)**

1. Move from Vercel Hobby to Pro if the app goes commercial or needs longer functions or more cron runs.
2. Move photo processing to a Cloudflare Queue consumer or a small worker host if confirm requests get slow.
3. Move Atlas from M0 to a dedicated tier for more storage, connections and backups.
4. Move rate-limit counters from MongoDB to a Redis service such as Upstash if MongoDB load grows.

## Open decisions

Krishna confirmed the main choices on 17 Oct 2026; one item remains open.

- [x] **Hosting:** Vercel Hobby (App Runner no longer accepts new customers).
- [x] **Auth library:** Better Auth, with email verification turned off.
- [x] **Email provider:** Resend.
- [x] **Photo storage and delivery:** Cloudflare R2 with a Cloudflare Worker and CDN (replaces Amazon S3 and CloudFront).
- [x] **Photo upload method:** QR code per wedding and per event album.
- [ ] **Infrastructure as code:** Terraform (Cloudflare and Vercel providers), or manual setup documented in the README.
