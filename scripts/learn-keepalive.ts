// Visit LEARN without interacting. Status only; no page contents are logged.
import { appendFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";
import type { BrowserContext, Page } from "playwright";
import { untilTime } from './until-time.ts';
import { takeIdleKeepaliveLock } from './keepalive-lock.ts';

const ROOT = resolve(import.meta.dirname, "..");
const profile = resolve(ROOT, "data/browser");
const logDir = resolve(ROOT, "data/logs");
const interval = 20 * 60 * 1000;
const port = Number(process.env.ATRACKER_HELPER_PORT || 5199);
const profileLocked = /SingletonLock|ProcessSingleton|profile.*(use|lock)|user data directory.*use/i;

const { values } = parseArgs({ options: { until: { type: "string" } } });
let deadline = Infinity;
if (values.until !== undefined) {
  deadline = untilTime(values.until);
}

// The helper's existing health response reports scan/sign-in activity without credentials.
async function checkRunning(): Promise<boolean> {
  // Fail closed if the helper is unavailable: scan activity cannot be established.
  const response = await fetch(`http://127.0.0.1:${port}/health`, {
    headers: { Origin: 'http://localhost:5173' }, signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('Cannot establish scan state');
  const state = await response.json() as {ok?:boolean;busy?:boolean};
  if (state.ok !== true || typeof state.busy !== 'boolean') throw new Error('Invalid helper status');
  return state.busy;
}

type Result = { status: "signed-in" | "signed-out" | "error"; host: string };
async function visit(page: Page, url: string): Promise<Result> {
  let status: Result["status"] = "error";
  try {
    await page.goto(url, { waitUntil: "load", timeout: 60_000 });
    await sleep(5_000);
    const host = new URL(page.url()).hostname;
    const passwordVisible = await page.locator('input[type="password"]:visible').count() > 0;
    status = host !== "learn.uwaterloo.ca" || !new URL(page.url()).pathname.startsWith("/d2l/") || passwordVisible
      ? "signed-out" : "signed-in";
  } catch {
    // Keep the final host even when navigation or inspection failed.
  }
  let host = "unknown";
  try { host = new URL(page.url()).hostname || "unknown"; } catch {}
  return { status, host };
}

async function round() {
  let learn: Result = { status: "error", host: "unknown" };
  let note = "";
  let context: BrowserContext | undefined;
  let release: (() => Promise<void>) | undefined;
  try {
    if (await checkRunning()) {
      note = "scan or sign-in window running, skipped";
    } else {
      release = await takeIdleKeepaliveLock(resolve(logDir, 'learn-keepalive.lock'), checkRunning);
      if (!release) {
        note = 'scan or sign-in window running, skipped';
      } else {
      let chromium: typeof import("playwright").chromium;
      try {
        ({ chromium } = await import("playwright"));
      } catch {
        const require = createRequire(resolve(ROOT, "node_modules/@playwright/mcp/package.json"));
        ({ chromium } = require("playwright"));
      }
      context = await chromium.launchPersistentContext(profile, { headless: true, viewport: null });
      const page = context.pages()[0] ?? await context.newPage();
      learn = await visit(page, "https://learn.uwaterloo.ca/d2l/home");
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    note = !context && profileLocked.test(message) ? "profile in use, skipped" : "error: refresh failed";
  } finally {
    try { await context?.close(); } catch { note += " context close failed"; }
    await release?.();
  }
  const line = `${new Date().toISOString()} learn=${learn.status}${note ? ` ${note.replace(/[\r\n]+/g, " ")}` : ""}`;
  console.log(line);
  await mkdir(logDir, { recursive: true });
  await appendFile(resolve(logDir, "learn-keepalive.log"), line + "\n");
}

while (Date.now() < deadline) {
  const started = Date.now();
  try {
    await round();
  } catch (error) {
    console.error(`${new Date().toISOString()} keepalive round failed:`, error);
  }
  const delay = Math.min(Math.max(0, interval - (Date.now() - started)), deadline - Date.now());
  if (delay > 0) await sleep(delay);
}
