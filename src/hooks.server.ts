import { redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { privateConfig } from '$lib/server/config/private';
import { getDatabase } from '$lib/server/db/driver';
import { initializeStorage, cleanupStaging } from '$lib/server/storage/paths';
import { SESSION_COOKIE, validateSession } from '$lib/server/auth/sessions';
import { proxyIdentity } from '$lib/server/auth/proxy';

export const init: ServerInit = async () => {
  await initializeStorage();
  await cleanupStaging();
  getDatabase();
};

function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/healthz' ||
    pathname.startsWith('/_app/') ||
    pathname === '/favicon.svg' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/service-worker.js' ||
    pathname.startsWith('/icons/')
  );
}

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.authenticated = false;
  event.locals.identity = null;
  event.locals.sessionToken = null;

  if (privateConfig.authMode === 'none') {
    event.locals.authenticated = true;
    event.locals.identity = 'administrator';
  } else if (privateConfig.authMode === 'password') {
    const token = event.cookies.get(SESSION_COOKIE) ?? '';
    if (token && validateSession(token)) {
      event.locals.authenticated = true;
      event.locals.identity = 'administrator';
      event.locals.sessionToken = token;
    }
  } else {
    let address: string;
    try {
      address = event.getClientAddress();
    } catch {
      address = dev ? '127.0.0.1' : '';
    }
    const identity = proxyIdentity(event.request.headers, address);
    if (identity) {
      event.locals.authenticated = true;
      event.locals.identity = identity;
    }
  }

  if (!event.locals.authenticated && !isPublicPath(event.url.pathname)) {
    if (event.url.pathname.startsWith('/api/')) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
    throw redirect(
      303,
      `/login?returnTo=${encodeURIComponent(event.url.pathname + event.url.search)}`
    );
  }

  if (event.locals.authenticated && event.url.pathname === '/login') throw redirect(303, '/');

  const response = await resolve(event);
  const tileOrigin = (() => {
    try {
      return new URL(privateConfig.tileUrl.replaceAll(/\{[a-z]\}/g, '0')).origin;
    } catch {
      return 'https:';
    }
  })();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), payment=(), usb=()'
  );
  const contentSecurityPolicy = response.headers.get('Content-Security-Policy');
  if (contentSecurityPolicy && !privateConfig.tileProxyEnabled) {
    response.headers.set(
      'Content-Security-Policy',
      contentSecurityPolicy.replace(/img-src ([^;]+)/, (_directive, sources: string) => {
        const values = new Set(sources.split(/\s+/).filter(Boolean));
        values.add(tileOrigin);
        return `img-src ${[...values].join(' ')}`;
      })
    );
  }
  return response;
};
