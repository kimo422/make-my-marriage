# Make My Marriage — Database Design

Oct 17, 2026 · @Krishna Mohan P

## Overview and conventions

All data lives in one MongoDB Atlas database, `mmm`, on the free M0 cluster in Mumbai. The database has 18 collections: 4 managed by Better Auth and 14 owned by the app. The wedding is the tenant: every app collection except `weddings` itself and `rateLimits` carries a required `weddingId`.

This doc refines the PRD data model and the system design. Where they differ, this doc wins.

| Convention | Rule |
| --- | --- |
| Collection names | App collections are camelCase plurals (`households`, `photoReports`); Better Auth keeps its defaults (`user`, `session`, `account`, `verification`) |
| Field names | camelCase; references end in `Id` (`weddingId`, `eventId`); arrays of references end in `Ids` |
| Primary keys | MongoDB `ObjectId` in `_id`; never exposed in guest-facing URLs |
| Timestamps | `createdAt` and `updatedAt` on every document via Mongoose `timestamps: true`; stored in UTC, shown in IST (`Asia/Kolkata`) |
| Dates without time | Stored as UTC midnight `Date` plus the wedding's `timezone` field |
| Enums | Lowercase strings (`"bride"`, `"in_progress"`), validated by Mongoose and Zod |
| Emails | Trimmed and lowercased before save |
| Phone numbers | E.164 format (`+919876543210`); India (+91) assumed when no country code is entered |
| Tokens | Only SHA-256 hashes stored (`...TokenHash`), never the raw token. RSVP and gallery tokens are derived with HMAC-SHA256 from TOKEN\_SECRET, the record id and a version, so a link can be shown again; invite and device tokens are random |
| Soft delete | `deletedAt` on weddings and photos only; other records are deleted for real, with cascades (see Transactions) |
| Money | Not stored in the MVP (expenses are out of scope) |
| Tenant guard | A Mongoose plugin rejects any find, update or delete on a tenant collection without a `weddingId` filter |

## Entity relationships

The collections fall into five areas. A wedding is the hub: members join it through memberships, and events, guests and photos all belong to it.

&#91;embedded content: collections by area · 18 collections, 5 groups\]

Arrows show the main cross-area references: memberships and invites point to a wedding, RSVPs point to an event, and albums point to an event. References within an area run from the lower collection to the one above it (a guest belongs to a household, a photo to an album).

## Identity and access

Better Auth owns four collections and writes them through its MongoDB adapter. The app never edits them directly except to read the user's name and email. Membership in a wedding, not the account, decides what a user can do.

### user (Better Auth)

| Field | Type | Rules |
| --- | --- | --- |
| \_id | ObjectId | Better Auth id |
| name | string | Required, 1–80 chars |
| email | string | Required, unique, lowercased |
| emailVerified | boolean | Always `false` in the MVP (verification is off) |
| image | string | Optional avatar URL |
| createdAt, updatedAt | Date | Set by Better Auth |

### account (Better Auth)

One document per login method; the MVP only has the email and password method.

| Field | Type | Rules |
| --- | --- | --- |
| userId | ObjectId → user | Required |
| providerId | string | `"credential"` |
| accountId | string | Same as userId for credentials |
| password | string | Password hash (scrypt); never returned by any API |

### session (Better Auth)

| Field | Type | Rules |
| --- | --- | --- |
| userId | ObjectId → user | Required |
| token | string | Unique; matched to the session cookie |
| expiresAt | Date | 30 days, sliding; TTL index removes expired sessions |
| ipAddress, userAgent | string | Optional, for the "active sessions" list |

### verification (Better Auth)

Holds password-reset tokens: `identifier`, `value` and `expiresAt` (1 hour), removed by a TTL index.

### memberships

Links a user to a wedding with a role. A user can belong to many weddings.

| Field | Type | Rules |
| --- | --- | --- |
| weddingId | ObjectId → weddings | Required |
| userId | ObjectId → user | Required; unique together with weddingId |
| role | enum | `owner`, `manager`, `organizer`, `viewer` |
| side | enum | `bride`, `groom`, `both`; scopes which guests an organizer manages |
| invitedBy | ObjectId → user | Null for the wedding creator |
| joinedAt | Date | Set when the invite is accepted |

A wedding must always keep at least one `owner`. The service refuses to remove or demote the last one.

### invites

| Field | Type | Rules |
| --- | --- | --- |
| weddingId | ObjectId → weddings | Required |
| email | string | Lowercased; the invite can only be accepted by a logged-in user with this email |
| role, side | enum | As in memberships; `owner` invites allowed only from an owner |
| tokenHash | string | SHA-256 of the 32-byte invite token; unique |
| invitedBy | ObjectId → user | Required |
| status | enum | `pending`, `accepted`, `revoked` |
| expiresAt | Date | 7 days after creation |
| acceptedAt | Date | Set on accept |

## Wedding planning

The `weddings` document is the tenant root. It holds wedding-wide settings as embedded subdocuments (website and gallery), because they are small, always read together and never queried across weddings.

### weddings

| Field | Type | Rules |
| --- | --- | --- |
| brideName, groomName | string | Required, 1–60 chars |
| primaryDate | Date | Required; the main ceremony date, drives the countdown |
| city | string | Required |
| tradition | string | Optional, free text (for example "Telugu") |
| timezone | string | Default `Asia/Kolkata` |
| coverKey | string | R2 key of the cover photo |
| slug | string | Unique, lowercase, 3–60 chars, used in `/site/<slug>` |
| rsvpDeadline | Date | Optional; guests can change RSVPs until then |
| website | subdocument | See below |
| gallery | subdocument | See below |
| createdBy | ObjectId → user | Required |
| deletedAt | Date | Set on delete; data is purged by the daily cron after 30 days (owner delete) or straight away (automatic purge 6 months after primaryDate) |

**website subdocument:** `published` (boolean, default false), `theme` (`"traditional"`), `story` (string, up to 2,000 chars), `passwordHash` (optional), `indexable` (boolean, default false), `publishedAt` (Date).

**gallery subdocument:** `linkTokenHash` (unique sparse across weddings), `linkVersion` (number, incremented on regenerate, printed on QR cards, and part of the derived gallery token), `pinHash` (optional), `uploadsOpen` (boolean, default true), `uploadsCloseAt` (Date, optional), `reportHideThreshold` (number, default 3), `guestDownload` (`"compressed"`, `"originals"` or `"none"`), `storageQuotaBytes` (default 2 GB), `storageUsedBytes` (number, updated with `$inc`).

### events

| Field | Type | Rules |
| --- | --- | --- |
| weddingId | ObjectId → weddings | Required |
| name | string | Required, 1–60 chars |
| type | enum | `engagement`, `haldi`, `mehendi`, `sangeet`, `wedding`, `reception`, `custom` |
| startAt, endAt | Date | Required; endAt after startAt |
| venue | subdocument | `name`, `address`, `mapUrl` |
| dressCode | string | Optional |
| notes | string | Optional, up to 1,000 chars |
| isPublic | boolean | Default true; private events are hidden from the website |
| order | number | Manual sort order in the dashboard |

### tasks

| Field | Type | Rules |
| --- | --- | --- |
| weddingId | ObjectId → weddings | Required |
| title | string | Required, 1–120 chars |
| description | string | Optional, up to 2,000 chars |
| status | enum | `todo`, `in_progress`, `done` |
| priority | enum | `low`, `medium`, `high` |
| assigneeId | ObjectId → user | Optional; must be a member of the wedding |
| eventId | ObjectId → events | Optional |
| dueAt | Date | Optional |
| boardOrder | number | Position within its status column (fractional ordering, so a drag updates one document) |
| createdBy | ObjectId → user | Required |
| completedAt | Date | Set when status becomes `done` |

## Guests and RSVP

A household (a family) is the unit that is invited, messaged on WhatsApp and answers the RSVP; guests are the people inside it. RSVPs are stored one per household per event, so the counts the caterer needs come from a simple sum.

### households

| Field | Type | Rules |
| --- | --- | --- |
| weddingId | ObjectId → weddings | Required |
| name | string | Required, for example "Sharma family" |
| side | enum | `bride`, `groom`; organizers see only their side |
| group | string | Optional label such as "College friends" |
| maxHeadcount | number | Required, 1–20; cap for any event's RSVP |
| invitedEventIds | ObjectId\[\] → events | Events this household is invited to |
| rsvpTokenHash | string | SHA-256 of the RSVP link token, which is derived from the household id and rsvpTokenVersion; unique |
| rsvpTokenVersion | number | Default 1; raised to regenerate the RSVP link, which stops the old link working |
| primaryGuestId | ObjectId → guests | The contact whose phone gets the WhatsApp message |
| message | subdocument | `state` (`not_sent`, `sent`, `opened`, `responded`), `sentAt`, `sentBy`, `firstOpenedAt`, `lastReminderAt`, `reminderCount` |
| notes | string | Optional, members only |
| createdBy | ObjectId → user | Required |

### guests

| Field | Type | Rules |
| --- | --- | --- |
| weddingId | ObjectId → weddings | Required |
| householdId | ObjectId → households | Required |
| name | string | Required, 1–80 chars |
| phone | string | Optional, E.164; required for the primary guest |
| email | string | Optional, lowercased |
| relation | string | Optional, for example "Bride's uncle" |
| isChild | boolean | Default false; helps headcount planning |
| importBatchId | string | Set when created from a CSV import, so a bad import can be undone |

### rsvps

| Field | Type | Rules |
| --- | --- | --- |
| weddingId | ObjectId → weddings | Required |
| householdId | ObjectId → households | Required; unique together with eventId |
| eventId | ObjectId → events | Required; must be in the household's invitedEventIds |
| attending | boolean | Required |
| headcount | number | 0 when not attending; otherwise 1 to the household's maxHeadcount |
| source | enum | `guest` (via RSVP link) or `organizer` (entered by a member on a guest's behalf) |
| respondedAt | Date | Time of the latest answer |

An RSVP is upserted on `(householdId, eventId)`, so a guest who changes their answer overwrites it rather than adding a new row. The first RSVP from a household also sets `message.state` to `responded`.

## Gallery

Photos are stored in Cloudflare R2; MongoDB keeps only their keys, status and counts. Each album has its own QR code, so scan counts and uploads are tracked per album.

### albums

| Field | Type | Rules |
| --- | --- | --- |
| weddingId | ObjectId → weddings | Required |
| eventId | ObjectId → events | Optional; one album is created per event by default, plus a "General" album with no event |
| name | string | Required, 1–60 chars |
| visibility | enum | `link` (anyone with the gallery link), `pin` (PIN required), `members` (dashboard only) |
| coverPhotoId | ObjectId → photos | Optional |
| photoCount | number | Live photos only; updated with `$inc` |
| qrScanCount | number | Updated with `$inc` when the album's QR link opens |
| order | number | Display order |

### photos

| Field | Type | Rules |
| --- | --- | --- |
| weddingId | ObjectId → weddings | Required |
| albumId | ObjectId → albums | Required |
| status | enum | `processing`, `live`, `hidden` (auto-hidden after reports), `removed` |
| keys | subdocument | `original`, `display`, `thumb`: R2 object keys |
| width, height | number | Of the original, after rotation |
| bytes | number | Size of the stored original; counts toward the quota |
| uploaderTokenHash | string | Hash of the uploading browser's device token, so the uploader can delete their own photo |
| uploaderName | string | Optional name the guest typed, for example "Ravi" |
| uploadedByUserId | ObjectId → user | Set when a member uploads from the dashboard |
| reportCount | number | Updated with `$inc`; at the threshold the status becomes `hidden` |
| processingAttempts | number | Retried by the daily cron up to 3 times |
| liveAt | Date | When processing finished |
| removedAt, removedBy | Date, ObjectId | Set on removal; R2 objects purged 7 days later |

Photos keep no EXIF data, location or capture time, because metadata is stripped before the photo goes live.

### photoReports

| Field | Type | Rules |
| --- | --- | --- |
| weddingId | ObjectId → weddings | Required |
| photoId | ObjectId → photos | Required |
| reporterTokenHash | string | Hash of the reporting browser's device token; unique together with photoId, so one browser counts once |
| reason | enum | `inappropriate`, `unflattering`, `privacy`, `other` |

### uploads

Short-lived records of upload slots that guests requested but haven't confirmed yet.

| Field | Type | Rules |
| --- | --- | --- |
| weddingId | ObjectId → weddings | Required |
| albumId | ObjectId → albums | Required |
| incomingKey | string | R2 key under `incoming/`; unique |
| contentType | enum | `image/jpeg`, `image/png`, `image/heic` |
| uploaderTokenHash | string | Must match on confirm |
| expiresAt | Date | 1 day after creation; TTL index removes it |

## System

### activity

An append-only audit log shown on the dashboard ("Priya added 12 guests").

| Field | Type | Rules |
| --- | --- | --- |
| weddingId | ObjectId → weddings | Required |
| actorId | ObjectId → user | Null for guest actions (RSVP, upload) |
| actorLabel | string | Display name at the time, for example a guest's household name |
| action | enum | `created`, `updated`, `deleted`, `invited`, `rsvped`, `uploaded`, `moderated`, `regenerated_link` |
| entity | enum | `wedding`, `event`, `task`, `household`, `guest`, `member`, `photo`, `gallery` |
| entityId | ObjectId | The record acted on |
| summary | string | Short human-readable line, up to 200 chars |
| at | Date | Event time; a TTL index removes entries after 150 days |

### rateLimits

| Field | Type | Rules |
| --- | --- | --- |
| key | string | Unique, for example `login:<email>:<ip>` or `upload:<galleryToken>:<ip>` |
| count | number | Incremented with `$inc` and `upsert` |
| expiresAt | Date | End of the window; TTL index removes it |

## Indexes

Every tenant index starts with `weddingId`, so each query reads only one wedding's slice. Unique indexes enforce the rules the app must never break.

| Collection | Index | Type | Serves |
| --- | --- | --- | --- |
| user | `{ email: 1 }` | Unique | Login, invite matching |
| session | `{ token: 1 }` | Unique | Session lookup on every request |
| session | `{ expiresAt: 1 }` | TTL (0 s) | Removes expired sessions |
| account | `{ userId: 1, providerId: 1 }` | Standard | Password check at login |
| verification | `{ identifier: 1 }`; `{ expiresAt: 1 }` | Standard; TTL | Password reset |
| memberships | `{ weddingId: 1, userId: 1 }` | Unique | Permission check on every dashboard request |
| memberships | `{ userId: 1 }` | Standard | "My weddings" list |
| invites | `{ tokenHash: 1 }` | Unique | Invite accept |
| invites | `{ weddingId: 1, status: 1 }` | Standard | Pending invites list |
| invites | `{ expiresAt: 1 }` | TTL (30 days after expiry) | Clears old invites |
| weddings | `{ slug: 1 }` | Unique | Public website lookup |
| weddings | `{ "gallery.linkTokenHash": 1 }` | Unique, sparse | Gallery link and QR lookup |
| weddings | `{ deletedAt: 1 }` | Sparse | Cron purge of deleted weddings |
| events | `{ weddingId: 1, startAt: 1 }` | Standard | Event timeline |
| tasks | `{ weddingId: 1, status: 1, boardOrder: 1 }` | Standard | Task board columns |
| tasks | `{ weddingId: 1, assigneeId: 1, dueAt: 1 }` | Standard | "My tasks", overdue list |
| households | `{ rsvpTokenHash: 1 }` | Unique | Guest RSVP page |
| households | `{ weddingId: 1, side: 1, name: 1 }` | Standard | Guest list by side, sorted |
| households | `{ weddingId: 1, "message.state": 1 }` | Standard | WhatsApp invite and reminder queue |
| households | `{ weddingId: 1, invitedEventIds: 1 }` | Multikey | Invited count per event |
| guests | `{ weddingId: 1, householdId: 1 }` | Standard | Household detail |
| guests | `{ weddingId: 1, phone: 1 }` | Standard | Duplicate check on CSV import |
| rsvps | `{ householdId: 1, eventId: 1 }` | Unique | RSVP upsert |
| rsvps | `{ weddingId: 1, eventId: 1 }` | Standard | RSVP summary per event |
| albums | `{ weddingId: 1, order: 1 }` | Standard | Gallery album list |
| photos | `{ weddingId: 1, albumId: 1, status: 1, _id: -1 }` | Standard | Gallery grid, newest first, cursor paging |
| photos | `{ status: 1, removedAt: 1 }` | Partial (status `removed` or `processing`) | Cron purge and retry |
| photoReports | `{ photoId: 1, reporterTokenHash: 1 }` | Unique | One report per browser |
| uploads | `{ incomingKey: 1 }` | Unique | Upload confirm |
| uploads | `{ expiresAt: 1 }` | TTL (0 s) | Clears unconfirmed slots |
| activity | `{ weddingId: 1, at: -1 }` | Standard | Activity feed |
| activity | `{ at: 1 }` | TTL (150 days) | Log retention |
| rateLimits | `{ key: 1 }` | Unique | Limit check |
| rateLimits | `{ expiresAt: 1 }` | TTL (0 s) | Window reset |

Indexes are declared in each Mongoose schema and built by a migration script, not by `autoIndex` in production.

## Key queries

The app's busiest reads are the permission check, the guest RSVP page and the gallery grid. Each is a single indexed lookup.

| Screen | Query | Index used |
| --- | --- | --- |
| Every dashboard request | `memberships.findOne({ weddingId, userId })` | memberships unique |
| My weddings | `memberships.find({ userId })` then `weddings.find({ _id: { $in }, deletedAt: null })` | memberships userId |
| Guest RSVP page | `households.findOne({ rsvpTokenHash })`, then its events and RSVPs | households rsvpTokenHash |
| Gallery grid | `photos.find({ weddingId, albumId, status: "live", _id: { $lt: cursor } }).sort({ _id: -1 }).limit(40)` | photos compound |
| WhatsApp queue | `households.find({ weddingId, side, "message.state": "not_sent" })` | households message.state |
| Task board | `tasks.find({ weddingId }).sort({ status: 1, boardOrder: 1 })` | tasks status |

The gallery uses cursor paging on `_id` rather than `skip`, so scrolling deep into 3,000 photos stays fast.

**RSVP summary per event** (dashboard counts and the caterer export):

```js
// 1. Invited households and max headcount per event
db.households.aggregate([
  { $match: { weddingId } },
  { $unwind: "$invitedEventIds" },
  { $group: {
      _id: "$invitedEventIds",
      invitedHouseholds: { $sum: 1 },
      invitedHeadcount: { $sum: "$maxHeadcount" } } }
]);

// 2. Answers per event
db.rsvps.aggregate([
  { $match: { weddingId } },
  { $group: {
      _id: "$eventId",
      attendingHouseholds: { $sum: { $cond: ["$attending", 1, 0] } },
      declinedHouseholds: { $sum: { $cond: ["$attending", 0, 1] } },
      attendingHeadcount: { $sum: "$headcount" } } }
]);
```

The service merges the two results by event: pending households = invited − attending − declined. Running them as two simple pipelines avoids a `$lookup` across collections and keeps each one on its own index.

## Transactions, cascades and consistency

Most writes touch one document and need no transaction. Transactions are used only where two or more writes must succeed or fail together.

| Operation | Writes in one transaction |
| --- | --- |
| Create wedding | Insert wedding → insert owner membership → insert default "General" album |
| Accept invite | Set invite `accepted` → insert membership (fails cleanly if already a member) |
| Create event | Insert event → insert its album |
| Delete event | Delete its RSVPs → `$pull` it from every household's `invitedEventIds` → clear `eventId` on its tasks → move its album's photos to "General" → delete album and event |
| Delete household | Delete its guests and RSVPs → delete household |
| Regenerate gallery link | Set new `linkTokenHash`, `$inc linkVersion` → insert activity entry |
| Photo goes live | Set photo `live` → `$inc` album `photoCount` and wedding `gallery.storageUsedBytes` |
| Remove photo | Set photo `removed` → `$inc` both counters by the negative amount |

**Rules that the database alone can't enforce** (checked in the service layer, inside the same transaction where it applies):

- An RSVP's event must be in the household's `invitedEventIds`, and its headcount can't exceed `maxHeadcount`.
- A task's `assigneeId` must be a current member of the wedding.
- Every referenced id (event, album, household) must belong to the same `weddingId` as the document that references it.
- A wedding always keeps at least one owner.
- An upload slot is refused when `storageUsedBytes` plus the declared file size would exceed `storageQuotaBytes`.

**Deleting a wedding** is too large for one transaction on the free tier. It sets `deletedAt`, which immediately hides the wedding everywhere. The daily cron then deletes its records collection by collection in batches of 500, and finally the R2 objects under its `weddingId` prefix.

Counters (`photoCount`, `storageUsedBytes`, `qrScanCount`, `reportCount`) are kept with atomic `$inc`. Every Sunday, the daily cron also recounts them from source in case a crash left one out of step.

## Lifecycle, validation and migrations

**Retention**

| Data | Kept for | Removed by |
| --- | --- | --- |
| Sessions | 30 days after last use | TTL index |
| Password-reset tokens | 1 hour | TTL index |
| Unconfirmed upload slots | 1 day | TTL index (R2 lifecycle rule removes `incoming/` objects) |
| Rate-limit counters | The limit window (15 minutes to 1 hour) | TTL index |
| Expired or revoked invites | 30 days | TTL index |
| Removed photos | 7 days (undo window) | Daily cron, then R2 delete |
| Activity log | 150 days | TTL index |
| Deleted wedding | 30 days, hidden (the owner can restore it) | Daily cron purge |
| Everything else | Until 6 months after the wedding date, or earlier if the owner deletes the wedding | Daily cron purge (see Automatic purge) |

**Automatic purge:** every wedding, with all its records and every R2 photo, is deleted 6 months after its `primaryDate`. The daily cron finds due weddings through an index on `{ primaryDate: 1 }`.

- Owners get an email through Resend at 30 days and again at 7 days before deletion, with a link to "Download all" photos.
- On the day, the cron sets `deletedAt` and purges straight away in batches of 500, with no extra 30-day grace period.
- The countdown is shown on the dashboard from 5 months after the wedding date.

**Personal data (DPDP Act):** guest names, phone numbers and emails live only in `guests`, and are never copied into `activity` or logs. Deleting a household removes the guests and RSVPs in one transaction, which serves a guest's request to delete their data.

**Validation layers**

1. **Zod** at the API edge: shape, lengths, enums, E.164 phones, and stripping of `$`-prefixed keys.
2. **Mongoose schemas:** types, required fields, enums, `strict: true` (unknown fields dropped) and `strictQuery: true`.
3. **Service rules:** cross-document checks (see the previous section).
4. **MongoDB `$jsonSchema` validators** on `rsvps`, `memberships` and `photos`, the collections where a bad write is most costly, as a last line of defence.

**Migrations and seed data**

- Schema and index changes are scripted with `migrate-mongo` and run from GitHub Actions before each production deploy. Each script is idempotent and recorded in a `changelog` collection.
- New optional fields need no migration; Mongoose defaults fill them on read.
- A `seed` script creates the demo wedding for reviewers: 6 events, 150 households, 400 guests, mixed RSVPs, 40 tasks and sample photos.
- Local development and tests use `mongodb-memory-server`, so tests never touch Atlas.

## Capacity and decisions

One large Indian wedding needs roughly 6 MB in MongoDB, so the free 512 MB Atlas cluster holds dozens of weddings. Photo storage in R2 is the tighter limit. All figures below are rough estimates for a large wedding, not measurements.

| Collection | Documents per wedding | Avg size (approx.) | Total (approx.) |
| --- | --- | --- | --- |
| photos | 3,000 | 450 B | 1.4 MB |
| activity | 5,000 | 250 B | 1.3 MB |
| rsvps | 2,400 (400 households × 6 events) | 180 B | 0.4 MB |
| guests | 1,200 | 250 B | 0.3 MB |
| households | 400 | 450 B | 0.2 MB |
| tasks, events, albums, members | about 150 | 300 B | under 0.1 MB |
| **Data total** |  |  | **about 3.7 MB** |
| Indexes |  |  | about 2 MB |

**R2 storage:** 3,000 photos at about 1.2 MB original (capped at 3,000 px, JPEG quality 85), 300 KB display and 40 KB thumbnail come to about 4.6 GB. That is nearly half of R2's free 10 GB for one wedding. The default per-wedding quota of 2 GB (about 1,300 photos) keeps the demo safely inside the free tier.

**Decisions (confirmed 17 Oct 2026)**

- [x] **RSVP unit:** per household (one link per family, headcount per event).
- [x] **Original photo size:** originals capped at 3,000 px, JPEG quality 85.
- [x] **Old weddings:** deleted automatically 6 months after the wedding date, with all records and photos (see Lifecycle).
- [x] **Activity log retention:** 150 days.
