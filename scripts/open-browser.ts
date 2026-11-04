// Sign in using the same profile as the Codex browser.
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { setTimeout as sleep } from 'node:timers/promises';
import { COOKIE_FLUSH_MS, enableSessionRestore, inspectLearn, persistLearnSession } from './learn-session.ts';

const ROOT = resolve(import.meta.dirname, "..");
const profile = resolve(ROOT, "data/browser");
let chromium: typeof import("playwright").chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  const require = createRequire(resolve(ROOT, "node_modules/@playwright/mcp/package.json"));
  ({ chromium } = require("playwright"));
}

try {
  await enableSessionRestore(profile);
  const context = await chromium.launchPersistentContext(profile, { headless: false, viewport: null });
  let isClosed = false;
  const closed = new Promise<void>((done) => context.once("close", () => { isClosed = true; done(); }));
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto("https://learn.uwaterloo.ca");
  process.send?.({ready:true});
  let firstPersist: number | undefined;
  let announced = false;
  while (!isClosed) {
    try {
      for (const tab of context.pages()) {
        if ((await inspectLearn(tab)).status !== 'signed-in') continue;
        if (await persistLearnSession(context) && firstPersist === undefined) {
          firstPersist = Date.now();
          console.log('LEARN sign-in detected. Please wait about 35 seconds before closing this window.');
        }
        break;
      }
      if (!isClosed && firstPersist !== undefined && !announced && Date.now() - firstPersist >= COOKIE_FLUSH_MS) {
        console.log('LEARN sign-in saved. You can close this window.');
        announced = true;
      }
    } catch {
      // Closing or navigating may interrupt a poll. Never log browser errors or cookies.
    }
    if (!isClosed) await Promise.race([closed, sleep(3000)]);
  }
} catch (e) {
  const message = (e as Error).message;
  process.send?.({error:'Could not open LEARN. Close any existing sign-in window and check that Playwright Chromium is installed.'});
  console.error(/SingletonLock|ProcessSingleton|profile.*(use|lock)|user data directory.*use/i.test(message)
    ? "The Codex browser profile is in use. Close its window or wait for the check to finish, then try again."
    : "Couldn't open the sign-in window. Close existing profile browsers and check the Playwright installation.");
  process.exitCode = 1;
}

