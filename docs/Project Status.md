
# Make My Marriage — Project Status

Last updated: 22 Oct 2026

This is the running record of what has been built, phase by phase, and what is still to come. The PRD says *what* the product does; this doc says *where we are*. Update it at the end of every phase.

## At a glance

| Phase | Scope | Status | Where |
| --- | --- | --- | --- |
| 0 | Scaffold, tooling and CI | Done | `main` |
| — | Homepage and onboarding screens from Stitch | Done | `main` (PR #7) |
| 1 | Accounts: sign-up, sign-in, password reset | Done | `main` (PR #8) |
| 2 | Weddings, members, invite links, activity log | Done | `main` (PR #9) |
| 3 | Events, tasks, starter checklists, dashboard home | Done | `main` (PR #10) |
| 4 | Guests, households, RSVP, WhatsApp invites | Not started | |
| 5 | Photo storage, wedding website, invite card | Not started | |
| 6 | Photo gallery with QR uploads and moderation | Not started | |
| 7 | Polish: PWA, demo data, end-to-end tests, launch | Not started | |

**Test count:** 159 automated tests passing (unit, API and full role matrix).

---

## Phase 0 — Scaffold, tooling and CI (done)

The foundation every later phase builds on. No user-facing features.

- Next.js 16 (App Router) with TypeScript in strict mode, npm, Tailwind CSS 4.
- Module structure (`src/modules/<name>/`: schema, types, model, repo, service, handlers) with ESLint rules that stop modules reaching into each other's internals.
- Environment variables validated with Zod at start-up, so a missing value stops the build.
- MongoDB connection shared across requests, transactions, and a **tenant guard** that rejects any query on a wedding's data without a `weddingId`.
- One wrapper for every API route: request id, same-origin check on changes, no caching, and a standard error format.
- `/api/health` (checks MongoDB), security headers, `noindex` on every page by default.
- Vitest on an in-memory MongoDB replica set; migrations with `migrate-mongo`.
- Git hooks (lint, format, commit-message format), GitHub Actions CI, Dependabot, and a deploy workflow that runs migrations before deploying to Vercel (switched off until production is set up).
- `CLAUDE.md` with the project's rules and decisions.
- A lockfile check that catches the Windows npm bug that broke Linux installs twice.

## Homepage and onboarding screens (done)

Designed in Google Stitch (project "Make My Marriage Homepage Hero", design system "Serene Editorial Planning") and built into the app.

- Design system as the app's theme: warm ivory, deep emerald, hairline borders, Newsreader headings, Inter body at 17 px, pill buttons, arch-topped cards. Deliberately modern, with little red or yellow.
- Homepage at `/`: hero with a product preview, features, how it works, family roles, privacy, FAQ. Copy limited to what the app actually does.
- Screens for sign-up, sign-in, forgot password, link sent, reset password and create wedding.
- `/preview` lists every screen while the app is being built.

## Phase 1 — Accounts (done)

PRD: FR-1.1, FR-1.2.

- Sign-up with name, email and password (at least 8 characters). **No email verification**, by decision.
- Sign-in, sign-out, and 30-day sessions that renew while in use.
- Forgot password: emailed link through Resend that works for 1 hour; resetting signs you out on other devices. Without a Resend key, development prints the link in the server log instead.
- Clear error messages: wrong password (with a reset link), email already registered, password too short, expired link.
- Every sign-in or sign-up request must come from the app itself, which blocks other sites from signing people in.
- Rate limits on sign-in, sign-up and reset requests (production only).
- `/account` page; signed-out visitors are sent to sign-in and brought back afterwards.
- Built on Better Auth, sharing the app's MongoDB connection.

## Phase 2 — Weddings, members and invites (done)

PRD: FR-1.3, FR-2.1, FR-4.1, FR-4.2, FR-4.3.

**Weddings**
- Create a wedding: bride and groom names, main date, city, optional tradition, website address. The address is suggested from the couple's names and checked live for availability.
- Wedding home with a countdown ("52 days to go"), your role, the planning team and recent activity.
- "Your weddings" page to switch between weddings; goes straight in when you have just one.
- Settings: edit details and the RSVP deadline.
- Delete with the website address typed back to confirm. The wedding disappears for everyone at once and can be restored by an owner for 30 days.

**Roles and permissions**
- Four roles per wedding: owner, wedding manager, organizer, viewer; organizers also have a side (bride's, groom's or both).
- The PRD's permission matrix lives in one file (`src/modules/members/permissions.ts`) and is checked on every request: strangers and deleted weddings get "not found", a role without the permission gets "forbidden".
- A wedding always keeps at least one owner; only owners can make or change owners.

**Members and invite links**
- Members page: change someone's role or side, remove them, or leave the wedding yourself.
- Invites are **links you share yourself** (for example on WhatsApp), by decision; no invite email. Each link works once, for 7 days, and only for the email it was made for. A newer link for the same person cancels the older one.
- Invite page shows whose wedding it is and the role, then lets the person sign in or create an account and join.

**Also**
- Activity log ("Ravi joined as organizer", "Santhvana updated the wedding details").
- Account deletion with your password; refused while you are a wedding's only owner.
- Styled "page not found" screen.
- Tests cover every route for every role, including attempts to use another wedding's ids.
- CI fix found while merging: lint now generates Next.js route types itself, so a clean checkout lints the same as a laptop.

## Phase 3 — Events, tasks and dashboard home (done)

PRD: FR-2.2, FR-2.3, FR-3.1–3.3, FR-5.1–5.4.

**Events**
- Add, edit, reorder and delete events: type (Engagement, Haldi, Mehendi, Sangeet, Wedding, Reception, Custom), name, date, start and end time, venue, address, Google Maps link, dress code, notes, and "show on the wedding website".
- Times are entered in the wedding's time zone (IST) and stored in UTC; an end time before the start means it runs past midnight (a late Sangeet).
- New events slot into the list by start time; planners can then move them up or down.
- Deleting an event first shows what it affects (tasks that will be unlinked), then unlinks them in the same transaction.

**Tasks**
- Board with To do, In progress and Done columns. Cards move with buttons (status menu, up, down) on every device, and by drag-and-drop on a computer. Positions are fractional, so a move rewrites one task, and a column is renumbered automatically if the gaps get too small.
- List view sorted by due date, with filters for "My tasks", overdue, event and person; filters live in the URL.
- Task form: title, details, assignee (members only), due date, linked event (this wedding's only), status, priority.
- Overdue tasks are highlighted; finishing a task is recorded in the activity log.
- Organizers can create and edit any task; only managers or the task's creator can delete it.
- If two people edit or move the same task or event at once, the second gets "someone else changed this" instead of silently overwriting (If-Match).

**Starter checklists**
- A whole-wedding list (17 items, from the muhurtham to the emergency kit) and lists for each event type. Due dates count back from the event's day or the main wedding date; dates already past become today.
- Pick a list, untick what you don't need, and add the rest as normal tasks. The checklist wording is a first draft for review in `src/modules/tasks/checklists.ts`.

**Dashboard home**
- Countdown, events timeline, task progress ("1 of 4 done") with overdue count, your own open tasks, planning team and recent activity. RSVP totals and recent photos join in Phases 4 and 6.

**Also**
- 28 new tests: role matrix for every event and task route, time validation, If-Match conflicts, board ordering (including 60 moves into the same gap), the delete cascade, checklist dates, summary counts and cross-wedding isolation.
- Found during the walkthrough: event order changes were bumping `updatedAt`, which made a just-loaded copy look stale to If-Match. Reordering no longer counts as an edit.
- Not done: members who are removed keep their old task assignments (shown as "Former member"); reassigning them is a small follow-up.

## Phase 4 — Guests and RSVP (planned)

PRD: FR-6.1–6.6, FR-7.1–7.4.

- Households (families) and guests, bride's or groom's side; add one by one or import a CSV (preview first, undo within 24 hours).
- Choose which events each household is invited to, with a maximum headcount.
- Guest RSVP page from a personal link, no login: answer per event, change until the deadline, add to calendar.
- WhatsApp invites: a ready-written message with each family's link, sent from your own phone; tracks sent, opened and responded.
- Editable message templates (invitation, reminder, event day) and a reminder queue.
- RSVP dashboard per event and CSV export for the caterer.
- Organizers only see and manage guests on their own side; viewers see counts but no phone numbers or emails.

## Phase 5 — Photo storage, wedding website and invite card (planned)

PRD: FR-2.1 (cover photo), FR-7.5, FR-8.1–8.4.

- Cloudflare R2 photo storage and a small Cloudflare Worker that serves photos through signed links.
- Cover photo for the wedding.
- Public wedding website at `/site/<address>`: couple, story, public events with venues, RSVP entry and gallery link; publish or unpublish, optional password, hidden from search engines unless you choose otherwise.
- A shareable invite card image generated for each wedding.

## Phase 6 — Photo gallery (planned)

PRD: FR-10.1–10.9.

- Albums per event plus a General album; QR codes per wedding and per album, with a printable table card.
- Guests upload from their phones without an account (optional PIN); HEIC photos converted in the browser; location data stripped; thumbnails generated.
- Guests can delete their own uploads and report photos; reported photos hide automatically after 3 reports.
- Owners and managers remove photos, close uploads, set an end date, and regenerate the gallery link (old QR codes stop working).
- Download everything as a ZIP.
- Daily clean-up job: purge removed photos, deleted weddings after 30 days, and every wedding 6 months after its date.

## Phase 7 — Polish and launch (planned)

- Installable app (PWA) for the wedding day.
- Seeded demo wedding a reviewer can log into.
- End-to-end tests for the four key flows on a phone.
- Error tracking (Sentry), strict script security policy, performance pass for guest pages on 4G.
- Production deploys switched on; README with screenshots.

---

## Decisions that differ from the original docs

Agreed during planning (20 Oct 2026); `CLAUDE.md` holds the full list.

- One Next.js app on Vercel instead of the PRD's separate React app and Express API.
- No email verification at sign-up.
- Member invites are links you share, not emails.
- Uploads: up to 15 MB per photo, 10 per request; HEIC converted in the browser.
- Organizers can edit any task; viewers never see guest phone numbers or emails.
- No custom domain: the app runs on `*.vercel.app` and photos on `*.workers.dev`.
- Modern emerald-and-ivory design rather than a traditional red-and-gold look.

## Known limits and follow-ups

- **Email:** with no domain, Resend only delivers to the account owner's own address, so password-reset emails won't reach other users yet.
- **Production:** not deployed yet. Needs a production Atlas cluster, production environment variables on Vercel, and `DEPLOY_ENABLED=true` on GitHub.
- **Waiting on later phases:** the default "General" album at wedding creation (Phase 6) and the cover photo (Phase 5).
- **Not in the MVP:** expenses, vendors, travel and hotels, live stream, face search, other languages.

## Updating this document

At the end of each phase, move it to Done, list what was actually built (including anything changed or left out), update the test count and the date at the top, and note any new decisions or limits.
