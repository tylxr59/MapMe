import { createHash } from 'node:crypto';

interface Attempt {
  timestamps: number[];
  lastSeen: number;
}

export interface LoginClientKey {
  address: string;
  fingerprint: string;
}

const WINDOW_MS = 5 * 60 * 1000;
const PROGRESSIVE_DELAY_AFTER = 5;
const ADDRESS_DELAY_AFTER = 20;
const MAX_DELAY_SECONDS = 60;
const GLOBAL_WINDOW_MS = 60 * 1000;
const MAX_GLOBAL_PER_WINDOW = 100;
const MAX_TRACKED_CLIENTS = 10_000;
const clientAttempts = new Map<string, Attempt>();
const addressAttempts = new Map<string, Attempt>();
let globalAttempts: number[] = [];

function pruneAttempts(attempts: Map<string, Attempt>, cutoff: number): void {
  for (const [key, attempt] of attempts) {
    attempt.timestamps = attempt.timestamps.filter((time) => time > cutoff);
    if (attempt.timestamps.length === 0) attempts.delete(key);
  }
  if (attempts.size > MAX_TRACKED_CLIENTS) {
    const oldest = [...attempts.entries()]
      .sort((a, b) => a[1].lastSeen - b[1].lastSeen)
      .slice(0, attempts.size - MAX_TRACKED_CLIENTS);
    for (const [key] of oldest) attempts.delete(key);
  }
}

function prune(now: number): void {
  const cutoff = now - WINDOW_MS;
  globalAttempts = globalAttempts.filter((time) => time > now - GLOBAL_WINDOW_MS);
  pruneAttempts(clientAttempts, cutoff);
  pruneAttempts(addressAttempts, cutoff);
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function loginClientKey(address: string, userAgent: string | null): LoginClientKey {
  return {
    address: hash(address),
    fingerprint: createHash('sha256')
      .update(address)
      .update('\0')
      .update((userAgent ?? '').slice(0, 500))
      .digest('hex')
  };
}

function progressiveRetryMs(attempt: Attempt | undefined, delayAfter: number, now: number): number {
  const failureCount = attempt?.timestamps.length ?? 0;
  if (failureCount < delayAfter) return 0;
  const delaySeconds = Math.min(MAX_DELAY_SECONDS, 2 ** (failureCount - delayAfter));
  return Math.max(0, (attempt?.timestamps.at(-1) ?? 0) + delaySeconds * 1000 - now);
}

export function loginRateLimit(clientKey: LoginClientKey): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  prune(now);
  const clientRetryMs = progressiveRetryMs(
    clientAttempts.get(clientKey.fingerprint),
    PROGRESSIVE_DELAY_AFTER,
    now
  );
  const addressRetryMs = progressiveRetryMs(
    addressAttempts.get(clientKey.address),
    ADDRESS_DELAY_AFTER,
    now
  );
  const globalRetryMs =
    globalAttempts.length >= MAX_GLOBAL_PER_WINDOW
      ? Math.max(0, (globalAttempts[0] ?? now) + GLOBAL_WINDOW_MS - now)
      : 0;
  const retryAfterSeconds = Math.ceil(
    Math.max(clientRetryMs, addressRetryMs, globalRetryMs) / 1000
  );
  return {
    allowed: retryAfterSeconds === 0,
    retryAfterSeconds
  };
}

function recordFailure(attempts: Map<string, Attempt>, key: string, now: number): void {
  const attempt = attempts.get(key) ?? { timestamps: [], lastSeen: now };
  attempt.timestamps.push(now);
  attempt.lastSeen = now;
  attempts.delete(key);
  attempts.set(key, attempt);
}

export function recordLoginFailure(clientKey: LoginClientKey): void {
  const now = Date.now();
  recordFailure(clientAttempts, clientKey.fingerprint, now);
  recordFailure(addressAttempts, clientKey.address, now);
  globalAttempts.push(now);
  prune(now);
}

export function clearLoginFailures(clientKey: LoginClientKey): void {
  clientAttempts.delete(clientKey.fingerprint);
}
