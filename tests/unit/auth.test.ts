import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearLoginFailures,
  loginClientKey,
  loginRateLimit,
  recordLoginFailure
} from '$lib/server/auth/rate-limit';
import { proxyIdentity } from '$lib/server/auth/proxy';

afterEach(() => {
  vi.useRealTimers();
});

describe('login throttling', () => {
  it('uses short progressive delays without locking every client behind one proxy', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const first = loginClientKey('172.18.0.2', 'First browser');
    const second = loginClientKey('172.18.0.2', 'Second browser');

    for (let attempt = 0; attempt < 5; attempt++) recordLoginFailure(first);

    expect(loginRateLimit(first)).toEqual({ allowed: false, retryAfterSeconds: 1 });
    expect(loginRateLimit(second)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    vi.advanceTimersByTime(1_000);
    expect(loginRateLimit(first)).toEqual({ allowed: true, retryAfterSeconds: 0 });

    for (let index = 0; index < 15; index++) {
      recordLoginFailure(loginClientKey('172.18.0.2', `Rotating browser ${index}`));
    }
    const newcomer = loginClientKey('172.18.0.2', 'New browser');
    expect(loginRateLimit(newcomer)).toEqual({ allowed: false, retryAfterSeconds: 1 });
    vi.advanceTimersByTime(1_000);
    expect(loginRateLimit(newcomer)).toEqual({ allowed: true, retryAfterSeconds: 0 });

    clearLoginFailures(first);
    clearLoginFailures(second);
    clearLoginFailures(newcomer);
  });
});

describe('trusted proxy authentication', () => {
  it('accepts identity headers only from configured direct proxy networks', () => {
    const headers = new Headers({ 'remote-user': 'map owner' });
    expect(proxyIdentity(headers, '172.18.0.4', 'remote-user', ['172.18.0.0/16'])).toBe(
      'map owner'
    );
    expect(proxyIdentity(headers, '203.0.113.10', 'remote-user', ['172.18.0.0/16'])).toBeNull();
  });
});
