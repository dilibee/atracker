# ATracker

A day-based assignment planner for Waterloo ECE. React + TypeScript + Vite, Supabase realtime, private outline storage, iPhone web push, and a PC-only LEARN helper. Local mode works without an account; its data stays in the current browser. Cloud mode uses your existing Supabase login and syncs between devices.

## Development

Use Node 22.12+ (or 24+). On Windows, add `C:\Program Files\nodejs` to PATH and use `npm.cmd` if PowerShell blocks npm.ps1.

```
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

Open http://localhost:5173/atracker/. Production base is `/atracker/`. Vite intentionally does not automatically load `.env`, so secret-bearing files cannot be bundled accidentally. Set the three public `VITE_*` values in your shell for development, or use GitHub repository variables for production. With no public Supabase configuration it runs in local mode. Changes to environment configuration require a server restart.

## One-time setup

1. In the existing Supabase project `pnnpiretbukbnaejxjsk`, run `scripts/schema.sql` in SQL Editor. This creates `atracker_docs`, owner-only RLS, realtime publication, and the private `outlines` bucket with user-folder RLS. Existing organizer tables remain separate.
2. Copy `.env.example` to `.env` yourself. Fill in the public Supabase URL and anon key, the service-role key, and `ATRACKER_USER_ID` (your Auth user UUID). Never share the service-role key or put it in a `VITE_*` variable. Trusted helper/CLI/reminder scripts load `.env`; the scanning agent must never read it.
3. Run `npm run vapid` privately once and save its output to `.env`. Set `VAPID_SUBJECT` to your email contact. Keep the private key secret and keep keys stable so subscriptions stay valid.
4. Configure repository variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`. Configure repository secrets `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Enable GitHub Pages using Actions. The included deploy workflow builds `/atracker/`; publishing is a separate human action.
5. Add the deployed `/atracker/` URL and localhost development URL to Supabase Auth redirect allowlist. Sign in using the same email as the existing project. Email sign-in can set a password in Admin for other devices.
6. Install browser binaries with `npx playwright install chromium`. Install and sign into the Codex CLI (`npm install -g @openai/codex`, then `codex login`). Run `npm run browser`, sign into LEARN, then close that window. The persistent profile is private under `data/browser/`.
7. Set `APP_ORIGIN` in `.env` to your deployed origin (for example `https://YOUR-USERNAME.github.io`, without `/atracker/`). Run `npm run helper` on the PC. The helper only listens on loopback, accepts the configured origin and localhost development origins, and starts Codex with the Playwright MCP and scan runbook. Scans require a current Codex CLI supporting named filesystem permission profiles and `--strict-config` / `--ignore-user-config`; older versions fail rather than falling back to unrestricted reads. The scan profile makes source files read-only and denies `.env`, `.env.*`, the browser profile, and the credential loader. The agent-side `at` CLI delegates through a per-scan authenticated loopback broker; only the trusted helper loads credentials. User config is ignored during scans so legacy sandbox settings cannot override the profile. Playwright MCP uses an empty `data/scan-tools` working directory with client roots ignored, keeping upload/file tools away from repository secrets and the persistent profile. Allow browser local-network access if prompted. Admin shows Run LEARN scan only while reachable. Upload outlines from Admin before scanning. Review and approve/edit/reject proposals; nothing is automatically overwritten.
8. On iPhone (iOS 16.4+), open the deployed site in Safari → Share → Add to Home Screen. Open it there, sign in, then tap Enable notifications in Admin. The reminders workflow runs every 30 minutes; run it manually with workflow_dispatch to verify delivery. Reminder times are evaluated in your configured timezone at the next run; GitHub schedules may be delayed.

## Verification and operation

Planner tests cover spreading, ordered steps, milestones, overload/late risk, blackouts, preserved completion, pins and catch-up. A task date edit pins that task. Completed assignments leave the active plan. Settings and assignments replan immediately, including realtime changes. Due datetimes are displayed in the editing device's local timezone; scheduling and reminders use the configured timezone.

Verify cloud sync by creating a sample assignment on PC and observing it on the phone. Verify push with the manual reminders workflow. Verify scanning with the helper and your signed-in LEARN profile. These require your accounts and cannot be verified by a local build. Reminder deduplication is per notification and device, after successful delivery; a process crash between delivery and logging can repeat a message.

`npm run icons` regenerates PNGs from the SVG. `npm run at -- courses`, `outlines`, `propose <json>`, and `outline-done <path>` are trusted local commands. Outline uploads are limited to PDFs up to 20 MB. Do not expose the helper beyond localhost or run concurrent browser sessions against its profile.

With the dev server running, `node scripts/smoke.ts` checks desktop and phone layouts, assignment/task persistence, proposal approval and PDF extraction. Screenshots are saved under `data/screenshots/` (gitignored). Icon generation uses the same installed Chromium as the LEARN browser. Web Push payload encryption and VAPID signing use Node crypto; protocol roundtrip and signature tests run with the planner and proposal-validation tests.
