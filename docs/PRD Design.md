# Make My Marriage — MVP PRD

Oct 16, 2026 · @Krishna Mohan P

## Overview

Make My Marriage is a web app where an Indian family plans its whole wedding in one place: events, tasks, organizers, guests with per-event RSVP, a wedding website and a shared photo gallery.

**Problem.** Indian weddings run 3–5 days across several events with hundreds of guests. Planning lives in WhatsApp groups, Excel sheets and phone calls, so headcounts drift, tasks get dropped and photos end up scattered across dozens of phones.

**Goal.** A portfolio project that demonstrates production-grade full-stack skills: multi-tenant data, role-based access, public token-based pages, file uploads and notifications.

**Target users**

- **Couple** — create the wedding and own every decision.
- **Parents** — co-plan, manage their side's guests and tasks.
- **Guests** — no account; they act through personal links (RSVP, website, gallery).

**Market.** All of India, English only in the MVP.

## MVP scope

The MVP ships eight modules; expenses, vendors and extra languages wait for a later phase.

| Module | In MVP | Notes |
| --- | --- | --- |
| Wedding setup | Yes | Couple, date, cover photo, tradition tag |
| Events | Yes | Haldi, mehendi, sangeet, wedding, reception, custom |
| Organizers and roles | Yes | Invite by email, role-based access |
| Tasks | Yes | Board per wedding, linked to events |
| Guests and RSVP | Yes | Per-event invites, bride/groom side, households |
| Invitations and reminders | Yes | WhatsApp share links, no paid API |
| Wedding website | Yes | Public page built from dashboard data |
| Live stream | No | Phase 2 |
| Photo gallery | Yes | Link/QR access, guest uploads, owner moderation |
| Expense tracker | No | Phase 2 |
| Vendor management | No | Phase 2 |
| Guest travel and hotels | No | Phase 2 |
| Face search in gallery | No | Phase 2 |
| Multiple languages | No | English only |

**Assumptions**

- One wedding per account to start; the data model still supports many.
- Guests never create accounts; every guest action uses a signed, unguessable token link.
- WhatsApp messages are sent by an organizer tapping a prefilled `wa.me` link, so the app never sends messages itself.

## Users, roles and permissions

Every wedding has its own member list, and access is decided by role per wedding, not per account.

| Permission | Owner (couple) | Wedding Manager | Organizer | Viewer |
| --- | --- | --- | --- | --- |
| Edit wedding details and events | Yes | Yes | No | No |
| Invite or remove members, change roles | Yes | Managers only below Owner | No | No |
| Create and edit tasks | Yes | Yes | Own and assigned | No |
| Manage guests and send invites | Yes | Yes | Own side only | No |
| See RSVP dashboard | Yes | Yes | Yes | Yes |
| Publish wedding website | Yes | Yes | No | No |
| Moderate gallery, regenerate links | Yes | Yes | No | No |
| Delete wedding | Yes | No | No | No |

- A wedding can have two Owners (bride and groom).
- Parents are typically Wedding Managers; cousins and friends are Organizers.
- Organizers carry a **side** (bride, groom or both) that scopes which guests they manage.
- Guests are not members: they reach the RSVP page, website and gallery only through token links.

## Functional requirements

Each module below lists what the MVP must do; IDs (FR-x.y) are for tracking in the build.

### 1. Accounts and login

- FR-1.1 Sign up and log in with email and password only (no social or OTP login in the MVP); email is verified before first use, and passwords need at least 8 characters.
- FR-1.2 Forgot-password flow by emailed reset link.
- FR-1.3 A logged-in user sees all weddings they belong to and switches between them.

### 2. Wedding setup

- FR-2.1 Create a wedding: bride and groom names, primary wedding date, city, tradition (free text or picklist), cover photo.
- FR-2.2 A countdown to the main event on the dashboard home.
- FR-2.3 Dashboard home shows: days to go, events timeline, task progress, RSVP totals, recent gallery uploads.

### 3. Events

- FR-3.1 Add, edit, reorder and delete events: name, type, date, start and end time, venue name, address, map link, dress code, notes.
- FR-3.2 Suggested event types: Engagement, Haldi, Mehendi, Sangeet, Wedding, Reception, plus Custom.
- FR-3.3 Each event has a public or private flag for the website.

### 4. Organizers

- FR-4.1 Owners and Managers invite members by email with a role and side; the invite link expires in 7 days.
- FR-4.2 Change a member's role or remove them; an Owner cannot be removed by a Manager.
- FR-4.3 Activity log of key changes (who added, edited or deleted what).

### 5. Tasks

- FR-5.1 Create tasks with title, description, assignee (a member), due date, linked event, priority and status (To do, In progress, Done).
- FR-5.2 Board view by status and list view with filters by assignee, event and due date.
- FR-5.3 Optional starter checklist per event type the user can import and edit.
- FR-5.4 Overdue tasks are highlighted; "My tasks" view for each member.

### 6. Guests and RSVP

- FR-6.1 Add guests one by one or import a CSV: name, phone (with country code), email, side, group or household, relation, notes.
- FR-6.2 Households: one invite and one RSVP link can cover a family, with a max headcount.
- FR-6.3 Choose which events each guest or household is invited to.
- FR-6.4 The guest RSVP page (token link, no login) shows only their invited events; per event they answer attending or not and headcount.
- FR-6.5 Guests can change their RSVP until an RSVP deadline set per wedding.
- FR-6.6 RSVP dashboard: per event, invited, attending, declined and pending counts; export to CSV.

### 7. Invitations and reminders (WhatsApp share links)

- FR-7.1 For each guest, the app builds a prefilled WhatsApp message containing their personal RSVP link and opens it with a `wa.me` link on tap.
- FR-7.2 Editable message templates: invitation, RSVP reminder, event-day reminder.
- FR-7.3 Track message state per guest: Not sent, Sent (marked when the organizer taps), Opened (first visit to the link), Responded.
- FR-7.4 Reminder queue: a list of guests with pending RSVPs, sendable one tap at a time.
- FR-7.5 A digital invite card image per wedding that organizers can share alongside the message.

### 8. Wedding website

- FR-8.1 Public page at `/w/<slug>` built from wedding and event data: couple, story, events (public ones), venues with map links, RSVP entry, gallery link.
- FR-8.2 One traditional theme in the MVP (warm reds, maroon and gold, ornamental borders, serif headings); the couple sets a cover photo and edits a short "our story" text. More themes come later.
- FR-8.3 Publish or unpublish; optional site password; unpublished sites return 404.
- FR-8.4 Pages carry `noindex` by default, with a toggle to allow indexing.

### 9. Photo gallery

- FR-10.1 One gallery per wedding with albums (default one per event).
- FR-10.2 Guests open the gallery by link or QR code without an account; optional 4–6 digit PIN.
- FR-10.3 Guests upload photos without signing in; files pass validation (JPEG, PNG, HEIC; max 20 MB; image check) and publish immediately.
- FR-10.4 EXIF and GPS metadata are stripped on upload; thumbnails are generated.
- FR-10.5 An uploader can delete their own photos from the same browser (device token).
- FR-10.6 Guests can report a photo; it auto-hides after 3 reports pending owner review.
- FR-10.7 Owners and Managers can remove photos, close uploads, set an upload end date, and disable or regenerate the gallery link (old QR codes stop working).
- FR-10.8 Per-album visibility: everyone with the link, PIN only, or members only.
- FR-10.9 Owners can download all photos as a ZIP.

## Key user flows

Four flows carry the MVP demo; each should work end to end on a phone.

**A. Couple sets up the wedding**

1. Sign up with email, verify, land on "Create your wedding".
2. Enter names, date, city and tradition; upload a cover photo.
3. Add events from suggested types and fill dates and venues.
4. Import a starter task checklist and invite parents as Wedding Managers.

**B. Parent invites guests**

1. Accept the email invite and log in.
2. Import a CSV of the bride's side or add guests by hand, grouped into households.
3. Tick which events each household is invited to.
4. Open the invite queue and tap "Send on WhatsApp" per household; the app marks each as Sent.

**C. Guest RSVPs**

1. Opens the WhatsApp link on their phone; no login.
2. Sees a greeting with their name and only their invited events.
3. Picks attending or not and headcount per event; submits.
4. Gets a confirmation screen with links to the website and calendar files.

**D. Wedding day photos**

1. Guest scans the QR code on a table card and enters the PIN if set.
2. Picks photos from their phone; they upload and appear in the event's album.
3. Couple reviews reported photos and removes anything unwanted.
4. After the wedding, the couple closes uploads and downloads everything as a ZIP.

## Data model (MongoDB)

Eleven collections, every one except `users` keyed by `weddingId` so each wedding is an isolated tenant.

| Collection | Key fields | Indexes |
| --- | --- | --- |
| users | email, passwordHash, name, emailVerified | email (unique) |
| weddings | brideName, groomName, date, city, tradition, coverUrl, slug, rsvpDeadline, website {published, theme, story, password, indexable} | slug (unique) |
| memberships | weddingId, userId, role (owner, manager, organizer, viewer), side (bride, groom, both) | weddingId + userId (unique) |
| invites | weddingId, email, role, side, tokenHash, expiresAt, acceptedAt | tokenHash; TTL on expiresAt |
| events | weddingId, name, type, startAt, endAt, venue {name, address, mapUrl}, dressCode, isPublic, order | weddingId + startAt |
| tasks | weddingId, title, description, assigneeId, eventId, dueAt, priority, status | weddingId + status; weddingId + assigneeId |
| households | weddingId, name, side, maxHeadcount, invitedEventIds\[\], rsvpTokenHash, messageState, firstOpenedAt | weddingId + side; rsvpTokenHash |
| guests | weddingId, householdId, name, phone, email, relation, notes | weddingId + householdId |
| rsvps | weddingId, householdId, eventId, attending, headcount, updatedAt | householdId + eventId (unique) |
| albums / photos | weddingId, eventId, visibility; photos: albumId, storageKey, thumbKey, uploaderToken, status (live, hidden, removed), reportCount | weddingId + albumId + createdAt |
| activity | weddingId, actorId, action, entity, entityId, at | weddingId + at |

**Notes**

- RSVP and gallery tokens are random 32-byte values; only their hashes are stored.
- Gallery access settings (link token hash, PIN hash, uploads open, upload end date) live on the wedding document.
- Photos are stored in object storage; MongoDB keeps only keys and metadata.

## Architecture and API

The app is a classic MERN build: a React single-page app talks to one Node and Express REST API, which stores data in MongoDB and photos in object storage.

&#91;embedded content: system architecture · 2 clients, 1 API, 3 services\]

WhatsApp never touches the server: the dashboard builds the message, the organizer's phone sends it, and the guest's link comes back to the API.

| Layer | Choice |
| --- | --- |
| Frontend | React 18, Vite, React Router, TanStack Query, Tailwind CSS, React Hook Form |
| Backend | Node 20, Express, Mongoose, Zod for request validation |
| Auth | Email and password, bcrypt hashes, JWT in an httpOnly cookie |
| Photos | Cloudinary or an S3-compatible bucket; `sharp` for thumbnails and EXIF stripping |
| Email | Nodemailer through a transactional email provider |
| Hosting | Vercel (frontend), Render or Railway (API), MongoDB Atlas free tier |
| Testing | Vitest, Supertest for API routes, Playwright for the four key flows |

**API outline** (all dashboard routes under `/api/weddings/:weddingId`, guarded by membership and role)

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/signup`, `/auth/login`, `/auth/logout`, `/auth/verify`, `/auth/reset` |
| Weddings | `GET/POST /weddings`, `GET/PATCH/DELETE /weddings/:id` |
| Members | `GET /members`, `POST /invites`, `POST /invites/:token/accept`, `PATCH/DELETE /members/:id` |
| Events | `GET/POST /events`, `PATCH/DELETE /events/:id`, `PATCH /events/order` |
| Tasks | `GET/POST /tasks`, `PATCH/DELETE /tasks/:id`, `POST /tasks/import-checklist` |
| Guests | `GET/POST /households`, `POST /guests/import`, `PATCH /households/:id/message-state` |
| RSVP stats | `GET /rsvp/summary`, `GET /rsvp/export.csv` |
| Gallery admin | `PATCH /gallery/settings`, `POST /gallery/regenerate-link`, `DELETE /photos/:id` |
| Public (token) | `GET/PUT /public/rsvp/:token`, `GET /public/site/:slug`, `GET /public/gallery/:token`, `POST /public/gallery/:token/photos` |

## Non-functional requirements

The app must be safe to hand to real families: guest data stays scoped to one wedding, and every guest page works on a cheap phone on 4G.

**Security and privacy**

- Every dashboard query filters by `weddingId` and checks the caller's membership and role in middleware.
- Guest tokens are 32 random bytes, stored only as hashes; regenerating a gallery link invalidates the old one at once.
- Rate limits on login, RSVP submit and photo upload (per IP and per token).
- Uploads: file type checked by content, not extension; size cap 20 MB; EXIF and GPS stripped; per-wedding storage quota.
- Guest phone numbers and emails are visible only to members; never shown on public pages.
- Public pages send `noindex` headers by default, image URLs included.
- A privacy notice on guest pages explains what is collected and who can see it, in line with India's DPDP Act.

**Performance and reliability**

- Guest pages load in under 3 seconds on a mid-range Android phone over 4G.
- Gallery serves thumbnails first and lazy-loads full images.
- Large uploads retry on network drop; a failed photo never blocks the others.

**Usability**

- Fully responsive across phone, tablet and desktop: mobile-first layouts with breakpoints at 640, 768, 1024 and 1280 px, usable from 360 px width up. Every screen, both dashboard and guest pages, works by touch and by mouse and keyboard, with no horizontal scrolling.
- Installable as a PWA so organizers can open it like an app on the wedding day.
- Indian conventions by default: dates as DD MMM YYYY, times in IST, phone numbers with +91.

**Quality**

- TypeScript on both frontend and backend.
- Automated tests cover role checks, token pages and the four key flows.

## Milestones and open questions

The build runs in five milestones, each ending in something demoable; durations depend on the time you can give it.

1. **Foundation** — repo, TypeScript setup, auth, wedding creation, memberships and role middleware.
2. **Plan** — events, tasks (board and list), starter checklists, dashboard home.
3. **Guests** — households, CSV import, per-event invites, guest RSVP page, WhatsApp share queue, RSVP dashboard.
4. **Share** — wedding website with themes, gallery with guest uploads and owner moderation.
5. **Polish** — PWA, tests for the key flows, seed demo wedding, deploy, README with screenshots.

**Success criteria for the portfolio**

- A live demo URL with a seeded sample wedding a reviewer can log into.
- All four key flows work end to end on a phone.
- A guest can RSVP in under a minute from a WhatsApp link.
- Clean README: architecture diagram, data model, decisions and trade-offs.

**Open questions**

- [x] Login method: decided, email and password (FR-1.1).
- [ ] Do you want TypeScript, or plain JavaScript, across the MERN stack?
- [ ] Cloudinary or an S3-compatible bucket for photos?
- [x] Website theme: decided, traditional only (FR-8.2).
- [ ] How many weeks can you give the build, so milestones can get dates?
