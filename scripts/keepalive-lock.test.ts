import { it, expect, vi } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, stat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { takeIdleKeepaliveLock, takeKeepaliveLock, waitForKeepalive } from './keepalive-lock';

async function fixture(run: (path: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'keepalive-test-'));
  try { await run(join(dir, 'lock')); } finally { await rm(dir, { recursive: true, force: true, maxRetries: 3 }); }
}
it('excludes another keepalive and makes helper wait until browser closure releases the lock', async () => fixture(async path => {
  const release = await takeKeepaliveLock(path);
  expect(release).toBeTypeOf('function');
  expect(await takeKeepaliveLock(path)).toBeUndefined();
  expect(await waitForKeepalive(path, 10, 2)).toBe(false);
  const waiting = waitForKeepalive(path, 1000, 2).then(
    value => ({ value }), error => ({ error }),
  );
  try {
    await release!();
    expect(await waiting).toEqual({ value: true });
  } finally {
    await waiting;
  }
}));
it.each(['EBUSY', 'EPERM'])('retries transient %s reads and release failures', async code => fixture(async path => {
  const error = Object.assign(new Error('File in use'), { code });
  const remove = vi.fn(unlink).mockRejectedValueOnce(error);
  const release = await takeKeepaliveLock(path, { readFile, stat, unlink: remove });
  expect(release).toBeTypeOf('function');
  const read = vi.fn((path: string) => readFile(path, 'utf8')).mockRejectedValueOnce(error);
  // A transient read is held even when no time remains to poll again.
  expect(await waitForKeepalive(path, 0, 2, { readFile: read, stat, unlink })).toBe(false);
  const pollingRead = vi.fn((path: string) => readFile(path, 'utf8')).mockRejectedValueOnce(error);
  const waiting = waitForKeepalive(path, 1000, 2, { readFile: pollingRead, stat, unlink }).then(
    value => ({ value }), error => ({ error }),
  );
  try {
    await release!();
    expect(await waiting).toEqual({ value: true });
    expect(remove).toHaveBeenCalledTimes(2);
    expect(pollingRead.mock.calls.length).toBeGreaterThan(1);
    await release!(); // Missing locks are harmless.
  } finally {
    await waiting;
  }
}));
it('recovers a three-minute-old lock, even if its pid is alive', async () => fixture(async path => {
  await writeFile(path, JSON.stringify({ pid: process.pid, time: Date.now() - 180_001 }));
  const release = await takeKeepaliveLock(path);
  expect(release).toBeTypeOf('function'); await release!();
}));
it('recovers a dead pid and does not release a replacement owner', async () => fixture(async path => {
  await writeFile(path, JSON.stringify({ pid: 2147483647, time: Date.now() }));
  const release = await takeKeepaliveLock(path);
  expect(release).toBeTypeOf('function');
  await writeFile(path, JSON.stringify({ pid: process.pid, time: Date.now(), token: 'replacement' }));
  await release!();
  expect(await waitForKeepalive(path, 0)).toBe(false);
}));
it('rechecks health while holding the lock and yields to an accepted scan or sign-in', async () => fixture(async path => {
  const release = await takeIdleKeepaliveLock(path, async () => {
    expect(await waitForKeepalive(path, 0)).toBe(false);
    return true;
  });
  expect(release).toBeUndefined();
  expect(await waitForKeepalive(path, 0)).toBe(true);
}));
it('fails closed and releases the lock if the health recheck fails', async () => fixture(async path => {
  await expect(takeIdleKeepaliveLock(path, async () => { throw new Error('offline'); })).rejects.toThrow('offline');
  expect(await waitForKeepalive(path, 0)).toBe(true);
}));
