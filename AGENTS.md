# ATracker

Assignment tracker for Dilibe (1st-year ECE, Waterloo). Shared rules in ../AGENTS.md also apply.

## Project rules
- Never read `.env`, `data/browser/`, or any service-role key. Never push, deploy or publish.
- Node may not be on PATH; prepend `C:\Program Files
odejs`.
- Keep the UI working at phone widths (iPhone PWA).

## Context
Dilibe wants one place to log every assignment (manually, with one or more due dates and optional steps). The app plans work backwards from each deadline so it is spread out, not crammed onto the last day. It sends iPhone reminders, and it can be edited from both the PC and the phone. Extras: a button to run a one-off LEARN scan (Codex, PC only), course-outline import for key dates, a color-coded dashboard, a calendar, and an admin/settings area. Look: red left rail, light grey background, blue accents, clock-plus-paper icon.

The decided setup follows the existing **externals-organizer** pattern: Vite + React + TS PWA on GitHub Pages, data in the **existing Supabase project** (`pnnpiretbukbnaejxjsk`, same login), push notifications, and a LEARN scan that runs only on the PC. The scan reuses the **co-op-desk** Playwright-profile pattern.

## Stack and reuse
- New folder `assignments-tracker/`, scaffolded like `externals-organizer` (Vite 8, React 19, TS, Vitest, tsx scripts). The project's `CLAUDE.md` is just `@AGENTS.md`, and `AGENTS.md` holds the project rules.
- Reuse, adapted (copied, not imported):
  - `externals-organizer/src/lib/db.ts`: Supabase client, OTP and password sign-in, realtime sync, local-mode fallback.
  - `externals-organizer/scripts/schema.sql`: the doc-table shape and RLS policy.
  - `externals-organizer/.github/workflows/deploy.yml`: the Pages deploy.
  - `co-op-desk/scripts/open-browser.ts`: a persistent Playwright profile for signing into LEARN.
- New table **`atracker_docs`**: same shape as `docs` (user_id, collection, id, data jsonb, updated_at), with RLS and realtime. Collections:
  - `courses`: code, name, color. Seeded with MATH 115, MATH 117, ECE 105, ECE 150, ECE 190, COMMST 192 and ECE 198, with distinct colors (editable).
  - `assignments`: course, title, type, `dueDates[]` (label + datetime, so one item can have several milestones), `estDays`, `steps[]` (title, done, optional own due date), weight %, link, notes, status, source (`manual` | `learn` | `outline`).
  - `tasks`: dated check-offs: assignmentId, stepId, date, title, done, `pinned` (manual moves survive a re-plan).
  - `settings`: buffer days (2), max tasks per day (4), blackout dates, reminder times, timezone.
  - `proposals`: items found by the LEARN scan or an outline import, waiting for approve/edit/reject.
  - `pushSubs`, `reminderLog` (stops duplicate notifications), `scanRuns`.
- Storage bucket `outlines` (private) for uploaded course-outline PDFs.

## Scheduler (`src/lib/planner.ts`, pure and unit-tested). Day-based check-offs, no hours
Dilibe doesn't want time planning. The plan is a dated to-do checklist.
- Each assignment has an **estimated days needed** (Dilibe's guess; the default depends on type, e.g. problem set 3, lab report 4, project 7).
- **Finish target = earliest due date − 2 days.** The work window is the `estDays` days before the target, and it never starts before today.
- **Steps** become dated check-off tasks, spread evenly and in order across the window, so step N lands before step N+1.
  - With no steps entered, the app creates "Work on X (1/n)" tasks, one per window day, plus a final "Review & submit" task.
  - Several due dates (milestones) each get their own window.
- **Load leveling by task count.** When several assignments overlap, tasks shift to the lighter days in their window (soft cap: max tasks per day, a setting, default 4). This prevents last-day pile-ups.
- **At risk:** if the window is shorter than `estDays` (added late) or days overflow the cap, the item is flagged on the dashboard.
- The plan re-runs on every change. Unchecked past tasks roll forward into "Catch-up". Tasks Dilibe drags to another day are pinned and survive a re-plan.

## UI (red rail, `#F1F2F4` background, blue `#1D4ED8`-family accents, course colors on chips and bars)
- **Left red rail**: logo plus icons for Dashboard, Assignments, Calendar and Admin. On the phone it is a slim icon rail, with safe-area padding.
- **Dashboard**:
  - Today's tasks as a checklist, color-coded by course.
  - Overdue/catch-up items and due-soon items (next 14 days), with progress bars and at-risk flags.
  - Goal overview per assignment (percent done, next step, days left).
  - Tasks-per-day for the week and a course color legend.
- **Assignments**: a list filterable by course and status, plus an add/edit form (multiple due dates, steps, notes, "I think this needs ~N days").
- **Calendar**: month and week views, with deadlines (bold) and planned tasks (tinted) in course colors. Tapping a day shows its detail.
- **Admin / Settings**:
  - "Run LEARN scan" button: visible and working only when the local helper is reachable (PC).
  - Scan history and log.
  - Proposals review queue.
  - Outline upload.
  - Course and color editor.
  - Buffer, max-tasks-per-day and reminder settings.
  - Days-needed editor for each goal.
  - "Enable notifications".
- **Icon**: an SVG clock over a sheet of paper (red and blue), exported to the PNG sizes needed, including the 180px apple-touch-icon. The PWA manifest name is "ATracker".

## Reminders (iPhone web push)
- A service worker plus a `web-push` VAPID subscription saved to `pushSubs`. This needs iOS 16.4+, and the app must be added to the Home Screen.
- A GitHub Actions cron (`.github/workflows/reminders.yml`, every 30 min) runs `scripts/send-reminders.ts`, using the service-role key and VAPID keys from repo secrets. It sends:
  - a morning "Today's plan" notification,
  - an evening nudge if today's tasks are still unchecked,
  - a 3-day / 1-day / day-of notice for each due date.
- Reminders are de-duplicated through `reminderLog`.

## LEARN scan and outline import (PC only, run by Codex)
- `npm run browser` opens the Playwright profile (`data/browser/`, gitignored) so Dilibe can sign into LEARN once.
- `npm run helper` starts a local server on `localhost:5199` with CORS and the `Access-Control-Allow-Private-Network` header. The deployed site pings it, and Admin shows the scan button only when it answers. Pressing the button calls `POST /scan`.
- The helper runs `codex exec` with the Playwright MCP and the runbook in `docs/scan-runbook.md`:
  - It reads each course's Content, Dropbox/Assignments, Quizzes and Calendar on learn.uwaterloo.ca.
  - It also downloads outline PDFs that are new in the bucket and pulls out their dates (assignments, midterms, quizzes, exams).
  - Codex writes results only through `npm run --silent at -- propose <json>`. The CLI uses the service-role key from `.env`, which Codex must never read.
- Results land in `proposals`, where Dilibe approves, edits or rejects them in Admin. Nothing is overwritten automatically, and duplicates are matched on course + title + due date.
- `scanRuns` records the status and log, shown in Admin.

## Build split: Codex does all the hands-on work, Claude stays minimal (saves Claude credits)
- **Claude's only jobs:**
  - Copy this plan into `assignments-tracker/AGENTS.md` (one Write; `CLAUDE.md` is `@AGENTS.md`).
  - Start each Codex phase with a short `codex exec -s workspace-write` prompt that says "build phase N per AGENTS.md" and names the files to reuse by path. Claude doesn't paste or read their contents.
  - Read only Codex's result summary, plus `git diff --stat` and `npm test`/`npm run build` output. No full-file reads unless something fails.
  - Handle the outward-facing steps Codex isn't allowed to do: `git init`, `gh repo create atracker --public`, commit and push, `gh secret set` / `gh variable set`, and deploy checks.
- **Codex phases** (each runs in the background and Claude is notified when it finishes):
  1. Scaffold, `db.ts`/auth, `schema.sql`, `planner.ts` plus Vitest tests, and seeded courses.
  2. UI views and theme, icon PNGs, PWA manifest and service worker.
  3. Push subscription, VAPID key generation script, `send-reminders.ts`, and the reminders and deploy workflows.
  4. Local helper, `at` CLI, `docs/scan-runbook.md`, outline upload, and `npm run browser`.
  5. Codex's own `codex review --uncommitted` pass, fixing what it finds.
- **Fixes:** if a phase fails a test or build, Codex is re-run with the error output. Claude only steps in if Codex fails twice.
- **Commits:** after each phase, Claude makes one commit and push (cheap: `git status`, `diff --stat`, commit).

**Dilibe's one-time steps:**
- Run the SQL.
- Copy the service-role key into `.env` and the GitHub secrets.
- Sign into LEARN in the Playwright window.
- On the iPhone: Safari → Share → Add to Home Screen, then tap "Enable notifications".

## Verification (Codex runs the tests, builds and screenshots; Claude checks the pass/fail output)
- `npm test`: planner cases covering tasks spread evenly with nothing on the due date, multiple due dates, step ordering, the at-risk flag, pinned tasks kept, and rolled-forward misses.
- `npm run build` and a typecheck. Run the app via the `run` skill and screenshot the Dashboard, Calendar and Admin at desktop and phone widths.
- Add a sample assignment on the PC and confirm it appears on the phone (realtime).
- Run the reminders workflow by hand (`workflow_dispatch`) and confirm a push arrives on the iPhone.
- With the helper running, press "Run LEARN scan" and confirm proposals appear. Approving one creates an assignment and its scheduled sessions.
