interface Attempt {
  timestamps: number[];
  lastSeen: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 5;
const MAX_GLOBAL = 50;
const MAX_TRACKED_IPS = 10_000;
const attempts = new Map<string, Attempt>();
let globalAttempts: number[] = [];

function prune(now: number): void {
  const cutoff = now - WINDOW_MS;
  globalAttempts = globalAttempts.filter((time) => time > cutoff);
  for (const [ip, attempt] of attempts) {
    attempt.timestamps = attempt.timestamps.filter((time) => time > cutoff);
    if (attempt.timestamps.length === 0) attempts.delete(ip);
  }
  if (attempts.size > MAX_TRACKED_IPS) {
    const oldest = [...attempts.entries()]
      .sort((a, b) => a[1].lastSeen - b[1].lastSeen)
      .slice(0, attempts.size - MAX_TRACKED_IPS);
    for (const [ip] of oldest) attempts.delete(ip);
  }
}

export function loginRateLimit(ip: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  prune(now);
  const attempt = attempts.get(ip);
  const blocked =
    (attempt?.timestamps.length ?? 0) >= MAX_PER_IP || globalAttempts.length >= MAX_GLOBAL;
  const oldest = Math.min(attempt?.timestamps[0] ?? now, globalAttempts[0] ?? now);
  return {
    allowed: !blocked,
    retryAfterSeconds: blocked ? Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000)) : 0
  };
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const attempt = attempts.get(ip) ?? { timestamps: [], lastSeen: now };
  attempt.timestamps.push(now);
  attempt.lastSeen = now;
  attempts.delete(ip);
  attempts.set(ip, attempt);
  globalAttempts.push(now);
  prune(now);
}

export function clearLoginFailures(ip: string): void {
  attempts.delete(ip);
}
