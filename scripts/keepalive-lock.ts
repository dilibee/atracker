import { mkdir, open, readFile, stat, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const staleAfter = 3 * 60_000;
const lockFs: {
  readFile: (path: string, encoding: 'utf8') => Promise<string>;
  stat: typeof stat;
  unlink: typeof unlink;
} = { readFile, stat, unlink };
function transient(error: unknown) {
  return ['EPERM', 'EBUSY'].includes((error as NodeJS.ErrnoException).code ?? '');
}
function alive(pid: number) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code !== 'ESRCH'; }
}
export async function keepaliveLocked(path: string, fs = lockFs): Promise<boolean> {
  try { return await inspectLock(path, fs); }
  catch (error) {
    if (transient(error)) return true;
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}
async function inspectLock(path: string, fs: typeof lockFs): Promise<boolean> {
  let text: string;
  try { text = await fs.readFile(path, 'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
  try {
    const lock = JSON.parse(text);
    // A partially written file is treated as held; the next poll retries it.
    if (!Number.isInteger(lock.pid) || lock.pid <= 0 || !Number.isFinite(lock.time)) throw new Error('Incomplete lock');
    if (Date.now() - lock.time < staleAfter && alive(lock.pid)) return true;
  } catch {
    const info = await fs.stat(path).catch(error => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
    if (info && Date.now() - info.mtimeMs < staleAfter) return true;
  }
  // Do not remove a replacement owner's lock.
  if (await fs.readFile(path, 'utf8') === text) await fs.unlink(path).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
  return false;
}
// The helper reserves busy synchronously before waiting on this lock. Rechecking
// after acquisition covers requests accepted between the initial check and lock.
export async function takeIdleKeepaliveLock(path: string, isBusy: () => Promise<boolean>) {
  const release = await takeKeepaliveLock(path);
  if (!release) return;
  try {
    if (!await isBusy()) return release;
  } catch (error) {
    await release();
    throw error;
  }
  await release();
}
export async function takeKeepaliveLock(path: string, fs = lockFs): Promise<(() => Promise<void>) | undefined> {
  await mkdir(dirname(path), { recursive: true });
  if (await keepaliveLocked(path, fs)) return;
  const text = JSON.stringify({ pid: process.pid, time: Date.now(), token: randomUUID() });
  let file;
  try { file = await open(path, 'wx'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') return; throw error; }
  try { await file.writeFile(text); } finally { await file.close(); }
  return async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        if (await fs.readFile(path, 'utf8') === text) await fs.unlink(path);
        return;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
        if (!transient(error) || attempt >= 3) throw error;
        await sleep(10);
      }
    }
  };
}
export async function waitForKeepalive(path: string, timeout = 90_000, poll = 250, fs = lockFs): Promise<boolean> {
  const deadline = Date.now() + timeout;
  while (await keepaliveLocked(path, fs)) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return false;
    await sleep(Math.min(poll, remaining));
  }
  return true;
}
