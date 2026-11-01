// Sign in using the same profile as the Codex browser.
import { createRequire } from "node:module";
import { resolve } from "node:path";

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
  const context = await chromium.launchPersistentContext(profile, { headless: false, viewport: null });
  const closed = new Promise<void>((done) => context.once("close", () => done()));
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto("https://learn.uwaterloo.ca");
  await closed;
} catch (e) {
  const message = (e as Error).message;
  console.error(/SingletonLock|ProcessSingleton|profile.*(use|lock)|user data directory.*use/i.test(message)
    ? "The Codex browser profile is in use. Close its window or wait for the check to finish, then try again."
    : `Couldn't open the sign-in window: ${message}`);
  process.exitCode = 1;
}

