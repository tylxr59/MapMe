import { describe, expect, it } from 'vitest';
import { appConfigSchema, requestOrigin } from '$lib/server/config/app';

describe('application configuration', () => {
  it('uses standard Nginx Proxy Manager forwarding headers for the suggested origin', () => {
    const request = new Request('https://internal.invalid/setup', {
      headers: {
        host: 'mapme:3000',
        'x-forwarded-host': 'places.example.com',
        'x-forwarded-proto': 'https'
      }
    });
    expect(requestOrigin(request)).toBe('https://places.example.com');
  });

  it('rejects unsafe origins and invalid trusted proxy networks', () => {
    expect(
      appConfigSchema.safeParse({
        version: 1,
        origin: 'https://places.example.com/unexpected-path',
        authMode: 'none',
        passwordHash: '',
        proxyHeader: 'Remote-User',
        proxyTrustedCidrs: []
      }).success
    ).toBe(false);
    expect(
      appConfigSchema.safeParse({
        version: 1,
        origin: 'ftp://places.example.com',
        authMode: 'none',
        passwordHash: '',
        proxyHeader: 'Remote-User',
        proxyTrustedCidrs: []
      }).success
    ).toBe(false);
    expect(
      appConfigSchema.safeParse({
        version: 1,
        origin: 'https://places.example.com',
        authMode: 'proxy',
        passwordHash: '',
        proxyHeader: 'Remote-User',
        proxyTrustedCidrs: ['not-a-network']
      }).success
    ).toBe(false);
  });
});
