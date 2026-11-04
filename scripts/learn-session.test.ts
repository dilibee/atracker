import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cookieIdentity, classifyLearn, enableSessionRestore, persistLearnSession, sessionCookiesToPersist, visitLearn } from './learn-session';

describe('session cookie persistence with synthetic cookies only', () => {
  const cookie = {
    name: 'synthetic', value: 'synthetic-value', domain: 'learn.uwaterloo.ca', path: '/d2l/',
    expires: -1, httpOnly: true, secure: true, sameSite: 'Lax' as const,
    partitionKey: 'https://uwaterloo.ca',
  };
  it('changes only expiry, preserves all attributes, and does not mutate inputs', () => {
    const input = Object.freeze({ ...cookie, extraAttribute: 'preserved' });
    const [converted] = sessionCookiesToPersist([input], 1_700_000_000_999);
    expect(converted).toEqual({ ...input, expires: 1_700_043_200 });
    expect(input.expires).toBe(-1);
    expect(converted).not.toBe(input);
  });
  it('allows only session cookies on the three exact domains with optional leading dots', () => {
    const allowed = ['uwaterloo.ca', '.uwaterloo.ca', 'learn.uwaterloo.ca', '.learn.uwaterloo.ca', 'adfs.uwaterloo.ca', '.adfs.uwaterloo.ca'];
    const denied = ['uwaterloo.ca.evil.com', '.uwaterloo.ca.evil.com', 'eviluwaterloo.ca', 'other.uwaterloo.ca', 'example.com', '..uwaterloo.ca'];
    const inputs = [...allowed, ...denied].map(domain => ({ ...cookie, domain }));
    inputs.push({ ...cookie, expires: 1_800_000_000 }, { ...cookie, expires: 0 });
    expect(sessionCookiesToPersist(inputs, 0).map(item => item.domain)).toEqual(allowed);
  });
  it('renews only tracked identities on allowed domains and preserves cookie attributes', () => {
    const persistent = { ...cookie, expires: 1_700_001_000 };
    const foreign = { ...persistent, domain: 'other.uwaterloo.ca' };
    const untracked = { ...persistent, name: 'other' };
    const hashes = new Set([cookieIdentity(persistent), cookieIdentity(foreign)]);
    const result = sessionCookiesToPersist([persistent, foreign, untracked], 1_700_020_000_000, hashes);
    expect(result).toEqual([{ ...persistent, expires: 1_700_063_200 }]);
    expect(persistent.expires).toBe(1_700_001_000);
    expect([...hashes].every(hash => /^[a-f0-9]{64}$/.test(hash))).toBe(true);
  });
  it('renews only converted cookies when name and domain collide across paths or partitions', async () => {
    const persistent = { ...cookie, expires: 1_700_001_000 };
    const unrelated = [
      { ...persistent, path: '/other/' },
      { ...persistent, partitionKey: 'https://example.com' },
      { ...persistent, partitionKey: undefined },
    ];
    let jar = [{ ...cookie }, ...unrelated];
    const added: typeof jar[] = [];
    const context = {
      cookies: async () => jar,
      addCookies: async (cookies: typeof jar) => { added.push(cookies); },
    };
    let hashes = new Set<string>();
    const store = { load: async () => hashes, save: async (next: Set<string>) => { hashes = next; } };

    await persistLearnSession(context, store);
    expect(added[0]).toEqual([{ ...cookie, expires: expect.any(Number) }]);
    expect(hashes).toEqual(new Set([cookieIdentity(cookie)]));

    jar = [persistent, ...unrelated];
    await persistLearnSession(context, store);
    expect(added).toHaveLength(2);
    expect(added[1]).toEqual([{ ...persistent, expires: expect.any(Number) }]);
    expect(added[1][0].expires).toBeGreaterThan(persistent.expires);
    expect(jar).toEqual([persistent, ...unrelated]);
    expect(hashes).toEqual(new Set([cookieIdentity(cookie)]));
  });
  it('re-adds selected cookies through a fake context and skips empty selections', async () => {
    const added: unknown[] = [];
    const context = {
      cookies: async () => [{ ...cookie }],
      addCookies: async (cookies: readonly unknown[]) => { added.push(...cookies); },
    };
    let hashes = new Set<string>();
    const store = { load: async () => hashes, save: async (next: Set<string>) => { hashes = next; } };
    expect(await persistLearnSession(context, store)).toBe(true);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ ...cookie, expires: expect.any(Number) });
    context.cookies = async () => [{ ...cookie, expires: 123 }];
    // Previously converted persistent cookies roll forward on the next signed-in visit.
    expect(await persistLearnSession(context, store)).toBe(true);
    expect(added).toHaveLength(2);
    context.cookies = async () => [{ ...cookie, name: 'untracked', expires: 123 }];
    expect(await persistLearnSession(context, store)).toBe(false);
    expect(added).toHaveLength(2);
    expect(hashes.size).toBe(0);
  });
});

it('sets session restore and preserves unrelated preferences in a synthetic profile', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'learn-session-test-'));
  try {
    await enableSessionRestore(profile);
    const path = join(profile, 'Default', 'Preferences');
    expect(JSON.parse(await readFile(path, 'utf8')).session.restore_on_startup).toBe(1);
    await writeFile(path, JSON.stringify({ other: true, session: { other: 2, restore_on_startup: 5 } }));
    await enableSessionRestore(profile);
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ other: true, session: { other: 2, restore_on_startup: 1 } });
    await writeFile(path, '{invalid');
    await expect(enableSessionRestore(profile)).rejects.toThrow('Could not configure LEARN session restore');
    expect(await readFile(path, 'utf8')).toBe('{invalid');
  } finally { await rm(profile, { recursive: true, force: true }); }
});

describe('settle and classify with no browser', () => {
  function fake(redirectAt = Infinity, navigationFails = false, inspectionFails = false) {
    let elapsed = 0;
    const page = {
      goto: async () => { if (navigationFails) throw new Error('navigation interrupted'); },
      url: () => elapsed >= redirectAt ? 'https://learn.uwaterloo.ca/d2l/home' : 'https://adfs.uwaterloo.ca/adfs/ls/',
      locator: () => ({ count: async () => { if (inspectionFails) throw new Error(); return elapsed < redirectAt ? 1 : 0; } }),
    };
    const timing = { now: () => elapsed, sleep: async (ms: number) => { elapsed += ms; } };
    return { page, timing };
  }
  it('allows a slow ADFS redirect, even after interrupted goto', async () => {
    const { page, timing } = fake(19_000, true);
    expect((await visitLearn(page, 'https://learn.uwaterloo.ca', timing)).status).toBe('signed-in');
    expect(timing.now()).toBe(20_000);
  });
  it('classifies a persistent ADFS page only after the grace period', async () => {
    const { page, timing } = fake();
    expect((await visitLearn(page, 'https://learn.uwaterloo.ca', timing)).status).toBe('signed-out');
    expect(timing.now()).toBe(20_000);
  });
  it('returns error when inspection fails', async () => {
    const { page, timing } = fake(0, false, true);
    expect((await visitLearn(page, 'https://learn.uwaterloo.ca', timing)).status).toBe('error');
  });
  it('does not mistake a login form, foreign host, root, or invalid URL for LEARN', () => {
    expect(classifyLearn('https://learn.uwaterloo.ca/d2l/home', true).status).toBe('signed-out');
    expect(classifyLearn('https://learn.uwaterloo.ca/d2l/login', false).status).toBe('signed-out');
    expect(classifyLearn('https://example.org/d2l/home', false).status).toBe('signed-out');
    expect(classifyLearn('https://learn.uwaterloo.ca/', false).status).toBe('signed-out');
    expect(classifyLearn('invalid', false).status).toBe('error');
  });
});
