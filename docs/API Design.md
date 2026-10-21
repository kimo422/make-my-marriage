# Make My Marriage — API Design

Oct 20, 2026 · @Krishna Mohan P

The app exposes a private JSON REST API under `/api`, built as Next.js route handlers that call the module services described in the System Design and the collections in the Database Design.

## Overview and conventions

The API serves three kinds of caller: signed-in members (the dashboard), guests holding a link token (RSVP, gallery, QR upload), and the daily Vercel Cron job. It is private to the app's own frontend, so it is not versioned in the MVP.

| Topic | Rule |
| --- | --- |
| Base path | `/api`; tenant routes are `/api/weddings/:weddingId/...`; guest routes are `/api/public/...`; cron is `/api/cron/...` |
| Style | REST over JSON (`Content-Type: application/json`); resources are plural nouns; methods `GET`, `POST`, `PATCH`, `DELETE` (no `PUT`, updates are partial) |
| Runtime | Next.js route handlers on Vercel (`bom1`); each handler is thin: authenticate, authorise, validate with Zod, call the module service |
| IDs | MongoDB `ObjectId` as a 24-character hex string in paths; guest-facing links use random tokens, never ids |
| Dates | ISO 8601 strings in UTC (`2027-02-07T13:30:00.000Z`); date-only fields are `YYYY-MM-DD` |
| Success shape | Single resource: `{ "data": { ... } }`; list: `{ "data": [ ... ], "page": { "nextCursor": "..." } }` |
| Error shape | `{ "error": { "code": "RSVP_OVER_CAPACITY", "message": "...", "fields": { "headcount": "Max is 4" } } }`; `fields` appears only for validation errors |
| Pagination | Cursor-based on `_id` (`?limit=40&cursor=...`); default limit 40, max 100. Used for photos, guests and activity; short lists (events, albums, tasks) return everything |
| Filtering and sorting | Simple query params (`?side=bride&status=todo`); fixed server-side sort per list, as in the Database Design indexes |
| Idempotency | `PUT`-style upserts are modelled as `POST` to a stable resource (RSVP). Creating uploads and invites accepts an optional `Idempotency-Key` header; a repeated key within 24 hours returns the first result |
| Concurrency | Task and event updates accept `If-Match: <updatedAt>`; a stale value returns `409 CONFLICT` so two organisers do not overwrite each other |
| Caching | Authenticated responses: `Cache-Control: private, no-store`. Public wedding site: short edge cache (60 s) with tag revalidation when the owner publishes |
| Request size | JSON bodies up to 100 KB; CSV import up to 2 MB; photos never pass through the API (direct to R2) |
| Tenant isolation | Every tenant route resolves `weddingId` from the path and checks the caller's membership; the Mongoose guard then forces `weddingId` on every query |
| CORS | Same-origin only; no cross-origin access in the MVP |
| Time zone | The API speaks UTC; the UI converts to the wedding's `timezone` (default `Asia/Kolkata`) |

## Authentication and access

Every request is classified into one of four caller types before any handler runs. The type decides which credential is read and what the caller can reach.

| Caller | Credential | Where it is sent | Reaches |
| --- | --- | --- | --- |
| Member | Better Auth session | httpOnly, Secure, SameSite=Lax cookie (30 days, sliding) | `/api/auth/*`, `/api/me`, `/api/weddings/...` |
| RSVP guest | 32-byte RSVP token (one per household) | In the path: `/api/public/rsvp/:token` | Only that household's RSVP data |
| Gallery guest | 32-byte gallery token; optional PIN | In the path: `/api/public/gallery/:token`; after a correct PIN, a signed 12-hour cookie | The wedding's visible albums and the upload flow |
| Cron | `Authorization: Bearer <CRON_SECRET>` | Header, sent by Vercel Cron | `/api/cron/*` only |

The database stores only SHA-256 hashes of tokens, so the handler hashes the path token and looks it up. A wrong, expired or regenerated token returns `404`, never `401`, so tokens cannot be probed.

**Account endpoints** are served by Better Auth under `/api/auth/*` (a catch-all route). The paths below follow Better Auth's documented defaults and should be re-checked against the library version at build time.

| Method and path | Purpose |
| --- | --- |
| `POST /api/auth/sign-up/email` | Create an account (name, email, password); no verification email |
| `POST /api/auth/sign-in/email` | Sign in; sets the session cookie |
| `POST /api/auth/sign-out` | End the session |
| `GET /api/auth/get-session` | Current session and user |
| `POST /api/auth/request-password-reset` | Email a reset link through Resend (always returns success) |
| `POST /api/auth/reset-password` | Set a new password using the emailed token |

**Request pipeline for tenant routes**

1. Read the session cookie and load the user (`401 UNAUTHENTICATED` if missing).
2. Look up the membership for `(weddingId, userId)` (`404 NOT_FOUND` if none, so a stranger cannot tell the wedding exists).
3. Check the role against the permission table below (`403 FORBIDDEN`).
4. For organisers, add the side filter to the query (`side` of their membership).
5. Validate path, query and body with Zod (`422 VALIDATION_FAILED`).
6. Call the module service, then write an `activity` entry for changes.

**Permission matrix**

| Capability | Owner | Manager | Organizer | Viewer |
| --- | --- | --- | --- | --- |
| View wedding, events, tasks, activity | Yes | Yes | Yes | Yes |
| View guests and RSVPs | All | All | Own side only | All (read-only) |
| Edit wedding details and website | Yes | Yes | No | No |
| Create, edit, delete events | Yes | Yes | No | No |
| Create and edit tasks | Yes | Yes | Yes | No |
| Add and edit households and guests | Yes | Yes | Own side only | No |
| Delete households; import CSV | Yes | Yes | Own side only | No |
| Enter RSVP on a guest's behalf | Yes | Yes | Own side only | No |
| Mark WhatsApp invite as sent | Yes | Yes | Own side only | No |
| Moderate and remove photos | Yes | Yes | No | No |
| Gallery settings, regenerate link and QR | Yes | Yes | No | No |
| Invite and remove members | Yes | Yes (not owners) | No | No |
| Change roles; transfer ownership | Yes | No | No | No |
| Delete the wedding | Yes | No | No | No |

**Security rules that apply everywhere**

- Mutating requests (`POST`, `PATCH`, `DELETE`) must send an `Origin` header matching `APP_URL`, and the SameSite cookie is the second line of defence against CSRF.
- Public routes never return internal ids of other households, members or user emails.
- A gallery PIN is compared in constant time against the stored hash, and failed attempts are rate limited per IP and per gallery token.

## Account, weddings, members and invites

A signed-in user can belong to many weddings. These endpoints create a wedding, manage who is in it and keep the activity trail. "Min role" is the lowest role allowed; O = owner, M = manager, Org = organizer, V = viewer.

**Account**

| Method and path | Min role | Purpose |
| --- | --- | --- |
| `GET /api/me` | Signed in | Current user and a list of their weddings with role, side, names and date; weddings deleted in the last 30 days are included with their delete date so an owner can restore them |
| `PATCH /api/me` | Signed in | Change display name |
| `DELETE /api/me` | Signed in | Delete the account with `{ password }` to confirm (`422` if wrong); refused with `409 SOLE_OWNER` while the user is the only owner of any wedding; removes all their memberships |

Password changes use Better Auth's own endpoint; they are not duplicated here.

**Weddings**

| Method and path | Min role | Purpose |
| --- | --- | --- |
| `POST /api/weddings` | Signed in | Create a wedding; caller becomes owner; creates the default "General" album (one transaction) |
| `GET /api/weddings/slug-availability?slug=` | Signed in | `{ slug, available }` for the live check on the create and settings forms; a malformed slug is reported as unavailable |
| `GET /api/weddings/:weddingId` | V | Wedding details, caller's role and side |
| `PATCH /api/weddings/:weddingId` | M | Edit names, date, city, tradition, RSVP deadline, slug |
| `DELETE /api/weddings/:weddingId` | O | Soft delete (sets `deletedAt`); body must repeat the wedding's slug to confirm |
| `POST /api/weddings/:weddingId/restore` | O | Undo a delete within the 30 days the wedding is hidden; an automatic purge cannot be undone |
| `GET /api/weddings/:weddingId/summary` | V | Dashboard numbers: days to go, RSVP totals per event, open tasks, photo count and storage used |
| `PATCH /api/weddings/:weddingId/website` | M | Website settings: `published`, `story`, `passwordProtected`, `indexable` |
| `GET /api/weddings/:weddingId/activity` | V | Activity feed, newest first, cursor paged |

**Members and invites**

| Method and path | Min role | Purpose |
| --- | --- | --- |
| `GET /api/weddings/:weddingId/members` | V | Members with role, side and join date |
| `PATCH /api/weddings/:weddingId/members/:userId` | M (O to change owners) | Change role or side; refused if it removes the last owner |
| `DELETE /api/weddings/:weddingId/members/:userId` | M, or the user themselves | Remove a member, or leave; refused for the last owner |
| `GET /api/weddings/:weddingId/invites` | M | Pending invites |
| `POST /api/weddings/:weddingId/invites` | M (O for owner invites) | Create an invite; returns the one-time `inviteUrl` for the inviter to share; revokes any earlier pending invite to the same email; `409 CONFLICT` if that person is already a member |
| `DELETE /api/weddings/:weddingId/invites/:inviteId` | M | Revoke a pending invite |
| `GET /api/invites/:token` | Public | Preview before accepting: wedding names, role, side (no email shown) |
| `POST /api/invites/accept` | Signed in | Accept with `{ token }`; the signed-in email must match the invite (`403` otherwise); creates the membership and returns `{ weddingId }`; `409 CONFLICT` with `details.weddingId` if already a member |

Transferring ownership is two calls by an owner: promote the other person to `owner`, then demote or leave. There is no separate transfer endpoint.

**Example: create a wedding**

```json
POST /api/weddings
{
  "brideName": "Ananya",
  "groomName": "Rohan",
  "primaryDate": "2027-02-07",
  "city": "Hyderabad",
  "tradition": "Telugu",
  "slug": "ananya-and-rohan"
}

201 Created
{
  "data": {
    "id": "6712f0a1c4e8b93d5a7e2b10",
    "slug": "ananya-and-rohan",
    "role": "owner",
    "timezone": "Asia/Kolkata"
  }
}
```

Errors: `409 SLUG_TAKEN` when the slug exists; `422 VALIDATION_FAILED` with `fields` for bad input.

## Events and tasks

Events are the functions (Haldi, Sangeet, Wedding and so on). Tasks are the shared checklist, optionally linked to an event. Both lists are short, so they return everything with no paging.

**Events**

| Method and path | Min role | Purpose |
| --- | --- | --- |
| `GET /api/weddings/:weddingId/events` | V | All events by start time |
| `POST /api/weddings/:weddingId/events` | M | Create an event; also creates its album (one transaction) |
| `GET /api/weddings/:weddingId/events/:eventId` | V | One event with invited and responded counts |
| `PATCH /api/weddings/:weddingId/events/:eventId` | M | Edit name, type, times, venue, dress code, notes, `isPublic` |
| `POST /api/weddings/:weddingId/events/reorder` | M | Set dashboard order with `{ "ids": ["..."] }` |
| `GET /api/weddings/:weddingId/events/:eventId/impact` | M | What deleting would affect: RSVPs removed, tasks unlinked, photos moved to "General" |
| `DELETE /api/weddings/:weddingId/events/:eventId` | M | Cascading delete as described in the Database Design; returns the same counts as `impact` |

The UI calls `impact` first and shows a confirmation with those counts before it calls `DELETE`.

**Tasks**

| Method and path | Min role | Purpose |
| --- | --- | --- |
| `GET /api/weddings/:weddingId/tasks` | V | Tasks; filters `status`, `assigneeId`, `eventId`, `overdue=true` |
| `POST /api/weddings/:weddingId/tasks` | Org | Create a task; `assigneeId` must be a current member |
| `PATCH /api/weddings/:weddingId/tasks/:taskId` | Org | Edit fields; sets `completedAt` when status becomes `done`; accepts `If-Match` |
| `POST /api/weddings/:weddingId/tasks/:taskId/move` | Org | Drag on the board: `{ status, beforeId, afterId }`; accepts If-Match; the server computes the fractional `boardOrder` |
| `DELETE /api/weddings/:weddingId/tasks/:taskId` | M, or the creator | Delete a task |

**Example: move a task to Done**

```json
POST /api/weddings/6712f0a1c4e8b93d5a7e2b10/tasks/6713a2b7c4e8b93d5a7e3c01/move
{ "status": "done", "beforeId": "6713a2b7c4e8b93d5a7e3c05", "afterId": null }

200 OK
{
  "data": {
    "id": "6713a2b7c4e8b93d5a7e3c01",
    "status": "done",
    "boardOrder": 1.5,
    "completedAt": "2026-10-20T04:55:12.000Z",
    "updatedAt": "2026-10-20T04:55:12.000Z"
  }
}
```

If another organiser moved the same task first, the call returns `409 CONFLICT` with the current task so the board can redraw.

## Households, guests, RSVP and WhatsApp invites

A household is the unit that is invited and answers. Organisers only ever see households on their own side; the service adds that filter, so these paths need no `side` parameter for them.

**Households and guests**

| Method and path | Min role | Purpose |
| --- | --- | --- |
| `GET /api/weddings/:weddingId/households` | V | Cursor-paged list; filters `side`, `group`, `messageState`, `eventId` (invited to), `rsvp=pending`, `q` (name search) |
| `POST /api/weddings/:weddingId/households` | Org | Create a household with its guests in one call (`guests: [...]`) |
| `GET /api/weddings/:weddingId/households/:householdId` | V | Household with guests, RSVPs and message state |
| `PATCH /api/weddings/:weddingId/households/:householdId` | Org | Edit name, side, group, `maxHeadcount`, `invitedEventIds`, `primaryGuestId`, notes |
| `DELETE /api/weddings/:weddingId/households/:householdId` | Org | Delete the household, its guests and RSVPs (one transaction) |
| `POST /api/weddings/:weddingId/households/:householdId/guests` | Org | Add a guest |
| `PATCH /api/weddings/:weddingId/guests/:guestId` | Org | Edit a guest |
| `DELETE /api/weddings/:weddingId/guests/:guestId` | Org | Remove a guest; the primary guest cannot be removed until another is chosen |

**CSV import** is two steps so nothing is written until the user has seen the problems.

| Method and path | Min role | Purpose |
| --- | --- | --- |
| `POST /api/weddings/:weddingId/guests/import/preview` | Org | Upload CSV (`multipart/form-data`, up to 2 MB); returns parsed rows, row errors and duplicates (matched on phone) with nothing saved |
| `POST /api/weddings/:weddingId/guests/import` | Org | Commit the previewed rows; returns an `importBatchId` |
| `DELETE /api/weddings/:weddingId/guests/import/:importBatchId` | Org | Undo an import within 24 hours |

**RSVPs (dashboard side)**

| Method and path | Min role | Purpose |
| --- | --- | --- |
| `GET /api/weddings/:weddingId/rsvps/summary` | V | Per event: invited, attending, declined, pending households and headcount (the two aggregation pipelines) |
| `GET /api/weddings/:weddingId/events/:eventId/rsvps` | V | Every invited household for the event with its answer or `pending`; cursor paged |
| `POST /api/weddings/:weddingId/households/:householdId/rsvps` | Org | Enter or change an answer on a household's behalf (`source: "organizer"`); upsert on household and event |
| `DELETE /api/weddings/:weddingId/households/:householdId/rsvps/:eventId` | Org | Reset to pending |
| `GET /api/weddings/:weddingId/rsvps/export.csv?eventId=` | M | Caterer export: one row per household with headcount |

**WhatsApp invites.** The app never sends a message. It prepares a `wa.me` link, the person taps it, and WhatsApp opens with the text ready.

| Method and path | Min role | Purpose |
| --- | --- | --- |
| `GET /api/weddings/:weddingId/households/:householdId/invite` | Org | Returns `{ rsvpUrl, whatsappUrl, messageText }`; `whatsappUrl` uses the primary guest's phone, or `https://wa.me/?text=` when there is none |
| `POST /api/weddings/:weddingId/households/:householdId/message/mark-sent` | Org | After the person has sent it: `{ "kind": "invite" }` or `{ "kind": "reminder" }`; sets `message.state`, `sentAt`, `sentBy`, `reminderCount` |
| `POST /api/weddings/:weddingId/households/:householdId/rsvp-link/regenerate` | Org | Makes the old RSVP link stop working and returns the new `rsvpUrl` |

The invite queue is not a separate endpoint: it is `GET .../households?messageState=not_sent&side=bride`.

**Design note: showing a link again.** WhatsApp sending and QR printing need a link on demand, so RSVP and gallery tokens are derived, not random: `token = base64url(HMAC-SHA256(TOKEN_SECRET, id + version))`. Only its SHA-256 hash is stored, for lookup. The version is `rsvpTokenVersion` on a household and `linkVersion` on the gallery; raising it regenerates the link and kills the old one. Keep `TOKEN_SECRET` private: anyone who has it can rebuild every link, and changing it invalidates all of them. Member invite tokens and device tokens stay random, because they are shown once or never.

**Example: organiser enters an RSVP for a household**

```json
POST /api/weddings/6712f0a1c4e8b93d5a7e2b10/households/6713b9d0c4e8b93d5a7e4a22/rsvps
{ "eventId": "6712f4e2c4e8b93d5a7e2b44", "attending": true, "headcount": 3 }

200 OK
{
  "data": {
    "householdId": "6713b9d0c4e8b93d5a7e4a22",
    "eventId": "6712f4e2c4e8b93d5a7e2b44",
    "attending": true,
    "headcount": 3,
    "source": "organizer",
    "respondedAt": "2026-10-20T05:02:40.000Z"
  }
}
```

Errors: `422 RSVP_OVER_CAPACITY` when `headcount` exceeds `maxHeadcount`; `422 EVENT_NOT_INVITED` when the event is not in `invitedEventIds`.

## Gallery (dashboard side)

These endpoints are for members managing the gallery. Photo bytes never pass through the API: images are served through the Cloudflare Worker on the image domain, and every `url` in a response is an HMAC-signed link that expires after 1 hour.

**Gallery settings and link**

| Method and path | Min role | Purpose |
| --- | --- | --- |
| `GET /api/weddings/:weddingId/gallery` | V | Settings, whether a PIN is set, link version, storage used and quota, and the current `galleryUrl` |
| `PATCH /api/weddings/:weddingId/gallery` | M | `uploadsOpen`, `uploadsCloseAt`, `reportHideThreshold`, `guestDownload`; `pin` to set a new PIN or `null` to remove it |
| `POST /api/weddings/:weddingId/gallery/link/regenerate` | M | New gallery link; every printed QR code stops working; bumps `linkVersion`; logged in activity |
| `GET /api/weddings/:weddingId/gallery/qr.svg?albumId=` | M | QR code as SVG for the wedding gallery, or for one album when `albumId` is given; the A6 table card is drawn in the browser from this SVG |

**Albums**

| Method and path | Min role | Purpose |
| --- | --- | --- |
| `GET /api/weddings/:weddingId/albums` | V | Albums with photo count, QR scan count and cover |
| `POST /api/weddings/:weddingId/albums` | M | Add a custom album (event albums are created with their event) |
| `PATCH /api/weddings/:weddingId/albums/:albumId` | M | Rename, change `visibility` (`link`, `pin`, `members`), `order`, `coverPhotoId` |
| `DELETE /api/weddings/:weddingId/albums/:albumId` | M | Custom albums only; `?movePhotosTo=<albumId>` is required when the album has photos |

**Photos**

| Method and path | Min role | Purpose |
| --- | --- | --- |
| `GET /api/weddings/:weddingId/photos` | V | Cursor-paged grid, newest first; filters `albumId`, `status`, `reported=true`; returns signed `thumbUrl` and `displayUrl` |
| `GET /api/weddings/:weddingId/photos/:photoId` | V | One photo with uploader name, report count and signed `displayUrl` |
| `GET /api/weddings/:weddingId/photos/:photoId/download?size=` | V | `size` is `original` or `display`; replies `302` to a short-lived signed URL |
| `PATCH /api/weddings/:weddingId/photos/:photoId` | M | Hide or show a photo (`status`: `hidden` or `live`); move it with `albumId` |
| `DELETE /api/weddings/:weddingId/photos/:photoId` | M | Mark removed; the R2 files are purged after 7 days |
| `POST /api/weddings/:weddingId/photos/:photoId/restore` | M | Undo a removal within 7 days |
| `POST /api/weddings/:weddingId/photos/bulk` | M | `{ action: "hide" or "show" or "remove" or "move", ids: [...], albumId? }`, up to 100 ids |
| `GET /api/weddings/:weddingId/photos/manifest` | V | For "Download all": a page of `{ id, filename, bytes, url }` for the owner's browser to fetch and zip; filters `albumId` and `size` |

Members upload from the dashboard with the same two-step flow guests use (see Upload flow); the only difference is the authenticated path and `uploadedByUserId` being set.

**Example: photo in the grid**

```json
GET /api/weddings/6712f0a1c4e8b93d5a7e2b10/photos?albumId=6712f4e2c4e8b93d5a7e2b50&limit=2

200 OK
{
  "data": [
    {
      "id": "6714c1e5c4e8b93d5a7e5d01",
      "albumId": "6712f4e2c4e8b93d5a7e2b50",
      "status": "live",
      "width": 3000,
      "height": 2000,
      "uploaderName": "Ravi",
      "reportCount": 0,
      "thumbUrl": "https://img.example.com/t/6714c1e5.jpg?exp=1792473600&sig=...",
      "displayUrl": "https://img.example.com/d/6714c1e5.jpg?exp=1792473600&sig=..."
    }
  ],
  "page": { "nextCursor": "6714c1e5c4e8b93d5a7e5d01" }
}
```

Signed URLs are generated per response and are not stored. A client that keeps a page open for more than an hour re-fetches it to get fresh links.

## Public and guest endpoints

Guests have no accounts. Each public route is reached with a token in the path, returns only what that token allows, and is rate limited by IP. A bad or regenerated token always returns `404`.

**Wedding website** (no token; the slug is public, and an optional website password applies)

| Method and path | Purpose |
| --- | --- |
| `GET /api/public/site/:slug` | Published site content: names, date, city, story, public events with venues. `404` if unpublished |
| `POST /api/public/site/:slug/unlock` | Check the website password; sets a signed 12-hour cookie. Only needed when a password is set |

**RSVP link** (token identifies one household)

| Method and path | Purpose |
| --- | --- |
| `GET /api/public/rsvp/:token` | The household name, its guests' first names, the events it is invited to (with time and venue), current answers, `maxHeadcount`, deadline. Marks `message.state` as `opened` the first time |
| `POST /api/public/rsvp/:token` | Submit answers for one or more events: `{ answers: [{ eventId, attending, headcount }] }`; upsert per event; sets `message.state` to `responded`. After `rsvpDeadline` it returns `409 RSVP_CLOSED` |

The `POST` is one request and one transaction for all events, so a family never ends up with half its answers saved.

**Gallery link and QR** (token identifies the wedding gallery; `?album=<eventId>` selects an album)

| Method and path | Purpose |
| --- | --- |
| `GET /api/public/gallery/:token` | Gallery info: names, albums the caller can see, whether uploads are open, whether a PIN is needed. Counts a QR scan for the chosen album |
| `POST /api/public/gallery/:token/pin` | Check the PIN; sets the signed 12-hour cookie. Rate limited to 5 wrong tries per 15 minutes per IP |
| `GET /api/public/gallery/:token/photos?albumId=&cursor=` | Live photos, newest first, with signed thumbnail and display URLs. Needs the cookie when a PIN is set |
| `POST /api/public/gallery/:token/albums/:albumId/uploads` | Step 1 of upload: ask for upload slots (below) |
| `POST /api/public/gallery/:token/uploads/:uploadId/confirm` | Step 2 of upload: process the uploaded file |
| `DELETE /api/public/gallery/:token/photos/:photoId` | Remove your own photo; allowed only when the device token matches the uploader |
| `POST /api/public/gallery/:token/photos/:photoId/report` | Report a photo; one report per device; at the threshold the photo is hidden |
| `GET /api/public/gallery/:token/download?size=` | Guest download of albums, only when `guestDownload` is not `none`; returns a manifest like the member endpoint, with `compressed` or `original` links |

**Device token.** Guests have no login, so each browser creates a random device token on first visit and sends it in the `X-Device-Token` header. Only its hash is stored (`uploaderTokenHash`, `reporterTokenHash`). It lets someone delete their own upload or report a photo once; it is not an identity, and clearing browser data loses it.

**Upload requests**

```json
POST /api/public/gallery/9fT3.../albums/6712f4e2c4e8b93d5a7e2b50/uploads
X-Device-Token: 3b1c...
{
  "uploaderName": "Ravi",
  "files": [
    { "contentType": "image/heic", "bytes": 3481920 },
    { "contentType": "image/jpeg", "bytes": 2210334 }
  ]
}

201 Created
{
  "data": [
    { "uploadId": "6714d0a2c4e8b93d5a7e5f10", "putUrl": "https://<account>.r2.cloudflarestorage.com/...", "headers": { "Content-Type": "image/heic" }, "expiresIn": 900 },
    { "uploadId": "6714d0a2c4e8b93d5a7e5f11", "putUrl": "https://<account>.r2.cloudflarestorage.com/...", "headers": { "Content-Type": "image/jpeg" }, "expiresIn": 900 }
  ]
}
```

Limits per request: up to 10 files, each up to 15 MB and of type `image/jpeg`, `image/png` or `image/heic`. A request fails with `403 UPLOADS_CLOSED` when uploads are off or past `uploadsCloseAt`, and `413 QUOTA_EXCEEDED` when the wedding's storage quota would be passed.

```json
POST /api/public/gallery/9fT3.../uploads/6714d0a2c4e8b93d5a7e5f10/confirm
X-Device-Token: 3b1c...

200 OK
{ "data": { "photoId": "6714d0a3c4e8b93d5a7e5f20", "status": "live" } }
```

Confirm checks that the file exists in R2 and the device token matches, then strips metadata, resizes, converts HEIC and goes live (details in the next section). If processing fails, the response is `202 Accepted` with `status: "processing"` and the daily cron retries it up to 3 times.

## Photo upload flow

A photo reaches the gallery in two API calls. The file itself goes from the phone straight to Cloudflare R2 on a signed link, so photo bytes never pass through the API.

&#91;embedded content: photo upload flow · 6 steps, 3 parties\]

Step 5 is the only heavy work. It runs inside the confirm call, and if it fails the photo stays in `processing` and the daily cron retries it. The same six steps apply to members uploading from the dashboard, on authenticated paths.

## System: cron, rate limits, errors and validation

**Cron.** One daily job, `GET /api/cron/cleanup`, started by Vercel Cron with `Authorization: Bearer <CRON_SECRET>`. It does its work in bounded batches, and anything left over continues on the next run. Every step is safe to repeat.

| Step | What it does |
| --- | --- |
| Removed photos | Delete photos removed more than 7 days ago from R2, then their records |
| Retry processing | Re-run photos stuck in `processing` (up to 3 attempts) |
| Deleted weddings | Purge weddings deleted more than 30 days ago: records collection by collection in batches of 500, then R2 objects |
| Automatic purge | Purge weddings whose `primaryDate` is more than 6 months ago, straight away |
| Reminders | Email owners via Resend 30 days and 7 days before an automatic purge |
| Recount | On Sundays, recount `photoCount`, `storageUsedBytes` and similar counters from source |

**Rate limits.** Counters live in the `rateLimits` collection. A blocked call returns `429 RATE_LIMITED` with a `Retry-After` header. These are proposed defaults to tune after testing.

| Area | Key | Limit |
| --- | --- | --- |
| Sign in | email and IP | 5 failures per 15 minutes |
| Sign up | IP | 10 per hour |
| Password reset request | email | 3 per hour |
| Gallery PIN | gallery token and IP | 5 wrong tries per 15 minutes |
| Upload slots | gallery token and IP | 60 files per hour |
| Photo report | device token | 20 per hour |
| RSVP submit | RSVP token | 20 per hour |
| Other public routes | IP | 120 per minute |
| Authenticated API | user | 300 per minute |

**Errors.** Every error uses the same body (see Overview). `code` is stable and meant for the client to switch on; `message` is for people.

| HTTP | Code | When |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | Body is not valid JSON |
| 401 | `UNAUTHENTICATED` | No valid session |
| 403 | `FORBIDDEN` | Role or side does not allow the action; also `UPLOADS_CLOSED` for gallery uploads |
| 404 | `NOT_FOUND` | Missing record, wedding the caller is not in, or bad or expired token |
| 409 | `CONFLICT` | Stale `If-Match`; the body carries the current record |
| 409 | `SLUG_TAKEN`, `SOLE_OWNER`, `LAST_OWNER`, `RSVP_CLOSED` | Named business rules |
| 413 | `PAYLOAD_TOO_LARGE`, `QUOTA_EXCEEDED` | Body or file too large; wedding's storage quota would be passed |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Upload is not a JPEG, PNG or HEIC image |
| 422 | `VALIDATION_FAILED` | Zod failed; `fields` lists each problem |
| 422 | `RSVP_OVER_CAPACITY`, `EVENT_NOT_INVITED` | RSVP rules |
| 429 | `RATE_LIMITED` | Over a limit; see `Retry-After` |
| 500 | `INTERNAL` | Unexpected error; the body has only a request id, never a stack trace |

**Validation.** Zod schemas live next to each module (`modules/*/schema.ts`) and are shared by the server and the forms, so a field has one definition. Rules: strings are trimmed; emails are lowercased; phones are normalised to E.164 (`+91` assumed); enums are lowercase; unknown keys are rejected; keys starting with `$` or containing `.` are stripped to block operator injection.

```ts
export const submitRsvpSchema = z.object({
  answers: z.array(z.object({
    eventId: objectId,
    attending: z.boolean(),
    headcount: z.number().int().min(0).max(20),
  })).min(1).max(12),
}).strict();
```

The schema checks shape only. Cross-record rules (event invited, headcount against `maxHeadcount`, deadline) run in the service inside the transaction.

**Tracing.** Every response carries an `X-Request-Id`. Errors log that id, the route, the caller type and the wedding id, and never log request bodies, tokens, phone numbers or emails.

## Decisions

All items below were settled on 20 Oct 2026. The first one also changed the Database Design and the System Design, which now match.

- [x] **Link tokens:** RSVP and gallery tokens are derived with `HMAC-SHA256(TOKEN_SECRET, id + version)`, so a link can be shown again for WhatsApp and QR printing. Adds a `TOKEN_SECRET` setting and `rsvpTokenVersion` on households (the gallery already has `linkVersion`).
- [x] **Member invites:** the inviter gets a link to share on WhatsApp. No invite email in the MVP.
- [x] **Upload limits:** 10 files per request and 15 MB per file.
- [x] **Restoring a deleted wedding:** an owner can restore it within the 30 days it is hidden, with `POST /api/weddings/:weddingId/restore`. An automatic purge is final.
- [x] **Concurrency on task moves:** the move endpoint accepts `If-Match`, like the other task updates.
- [x] **API documentation:** this document is the reference; no OpenAPI file in the MVP.
- [x] **Versioning:** none in the MVP because the API is private; move to `/api/v1` if a mobile app or public API is ever added.
