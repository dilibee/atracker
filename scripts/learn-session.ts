import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import type { BrowserContext, Cookie } from 'playwright';

export const COOKIE_FLUSH_MS = 35_000;
export const LEARN_NAVIGATION_MS = 60_000;
export const LEARN_SETTLE_MS = 20_000;

export function cookieIdentity(cookie: Pick<Cookie, 'name' | 'domain' | 'path' | 'partitionKey'>): string {
  return createHash('sha256').update(JSON.stringify([cookie.name, cookie.domain, cookie.path, cookie.partitionKey])).digest('hex');
}

const recordPath = resolve(import.meta.dirname, '../data/logs/learn-converted-cookies.json');
const convertedCookieStore = {
  async load(): Promise<Set<string>> {
    try {
      const record: unknown = JSON.parse(await readFile(recordPath, 'utf8'));
      if (!Array.isArray(record) || !record.every(hash => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash))) throw new Error();
      return new Set(record);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Set();
      throw new Error('Could not read LEARN cookie conversion record');
    }
  },
  async save(hashes: Set<string>): Promise<void> {
    try {
      await mkdir(dirname(recordPath), { recursive: true });
      await writeFile(recordPath + '.tmp', JSON.stringify([...hashes]), { mode: 0o600 });
      await rename(recordPath + '.tmp', recordPath);
    } catch { throw new Error('Could not save LEARN cookie conversion record'); }
  },
};

// Exact hosts only, allowing Chromium's leading dot for domain cookies.
export function sessionCookiesToPersist<T extends Cookie>(cookies: readonly T[], now: number, converted: ReadonlySet<string> = new Set()): T[] {
  const allowed = new Set(['uwaterloo.ca', 'learn.uwaterloo.ca', 'adfs.uwaterloo.ca']);
  return cookies.filter(cookie => (cookie.expires === -1 || converted.has(cookieIdentity(cookie)))
    && allowed.has(cookie.domain.replace(/^\./, '')))
    .map(cookie => ({ ...cookie, expires: Math.floor(now / 1000) + 12 * 60 * 60 }));
}

// Call only after confirming sign-in. Expiry renewal does not change server validity.
export async function persistLearnSession(
  context: Pick<BrowserContext, 'cookies' | 'addCookies'>,
  store = convertedCookieStore,
): Promise<boolean> {
  const converted = await store.load();
  const cookies = sessionCookiesToPersist(await context.cookies(), Date.now(), converted);
  // Retain only identities still selected, bounding the record to the current jar.
  if (cookies.length) await context.addCookies(cookies);
  // Mark conversions only after Chromium accepted them.
  await store.save(new Set(cookies.map(cookieIdentity)));
  return cookies.length > 0;
}

export async function inspectLearn(page: Pick<VisitPage, 'url' | 'locator'>): Promise<VisitResult> {
  try {
    const before = page.url();
    const passwordVisible = await page.locator('input[type="password"]:visible').count() > 0;
    if (before !== page.url()) return { status: 'error', host: 'unknown' };
    return classifyLearn(before, passwordVisible);
  } catch { return { status: 'error', host: 'unknown' }; }
}

const preferenceFs = { mkdir, readFile, writeFile, rename };

// Run only before launch, while the caller owns exclusive use of the profile.
// Persist the preference rather than just a launch flag: MCP uses this profile too.
export async function enableSessionRestore(profile: string, fs = preferenceFs): Promise<void> {
  try {
    const directory = join(profile, 'Default');
    const path = join(directory, 'Preferences');
    await fs.mkdir(directory, { recursive: true });
    let preferences: Record<string, unknown> = {};
    try {
      preferences = JSON.parse(await fs.readFile(path, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) throw new Error();
    const session = preferences.session;
    if (session !== undefined && (!session || typeof session !== 'object' || Array.isArray(session))) throw new Error();
    preferences.session = { ...(session as object | undefined), restore_on_startup: 1 };
    // Atomic replacement; never print preferences or errors that could contain them.
    const temporary = path + '.atracker-tmp';
    await fs.writeFile(temporary, JSON.stringify(preferences), { mode: 0o600 });
    await fs.rename(temporary, path);
  } catch {
    throw new Error('Could not configure LEARN session restore. Close all profile browsers and retry.');
  }
}

export type VisitResult = { status: 'signed-in' | 'signed-out' | 'error'; host: string };
type VisitPage = {
  goto(url: string, options: { waitUntil: 'load'; timeout: number }): Promise<unknown>;
  url(): string;
  locator(selector: string): { count(): Promise<number> };
};

export function classifyLearn(url: string, passwordVisible: boolean): VisitResult {
  try {
    const parsed = new URL(url);
    return {
      status: parsed.protocol === 'https:' && parsed.hostname === 'learn.uwaterloo.ca'
        && parsed.pathname.startsWith('/d2l/') && !/login|logon|signon|signin|auth/i.test(parsed.pathname)
        && !passwordVisible ? 'signed-in' : 'signed-out',
      host: parsed.hostname || 'unknown',
    };
  } catch { return { status: 'error', host: 'unknown' }; }
}

export async function visitLearn(
  page: VisitPage,
  url: string,
  timing: { now(): number; sleep(ms: number): Promise<void> } = { now: Date.now, sleep },
): Promise<VisitResult> {
  try {
    await page.goto(url, { waitUntil: 'load', timeout: LEARN_NAVIGATION_MS });
  } catch {
    // Redirects may interrupt goto. Still allow the final navigation to settle.
  }
  const deadline = timing.now() + LEARN_SETTLE_MS;
  // Give ADFS the full grace period, including when its login form is visible.
  while (timing.now() < deadline) await timing.sleep(Math.min(250, deadline - timing.now()));
  return inspectLearn(page);
}
