import { createHash, randomBytes } from 'node:crypto';
import { getDatabase } from '$lib/server/db/driver';
import { privateConfig } from '$lib/server/config/private';

export const SESSION_COOKIE = 'mapme_session';

export function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function passwordFingerprint(): string {
  return sha256(privateConfig.authPasswordHash);
}

export function createSession(): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + privateConfig.authSessionTtlDays * 86_400_000);
  const database = getDatabase();
  database
    .prepare(
      `INSERT INTO auth_sessions
         (token_hash, password_fingerprint, created_at, expires_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      sha256(token),
      passwordFingerprint(),
      now.toISOString(),
      expiresAt.toISOString(),
      now.toISOString()
    );
  return { token, expiresAt };
}

export function validateSession(token: string): boolean {
  if (token.length < 32 || token.length > 100) return false;
  const database = getDatabase();
  const now = new Date().toISOString();
  database.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(now);
  const tokenHash = sha256(token);
  const row = database
    .prepare(
      `SELECT token_hash
       FROM auth_sessions
       WHERE token_hash = ? AND password_fingerprint = ? AND expires_at > ?`
    )
    .get(tokenHash, passwordFingerprint(), now);
  if (!row) return false;
  database
    .prepare('UPDATE auth_sessions SET last_seen_at = ? WHERE token_hash = ?')
    .run(now, tokenHash);
  return true;
}

export function deleteSession(token: string): void {
  getDatabase().prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(sha256(token));
}

export function clearSessions(): void {
  getDatabase().exec('DELETE FROM auth_sessions');
}
