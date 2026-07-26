import { fail, redirect, type Actions } from '@sveltejs/kit';
import { getAppConfig } from '$lib/server/config/app';
import { verifyPassword } from '$lib/server/auth/password';
import {
  clearLoginFailures,
  loginRateLimit,
  recordLoginFailure
} from '$lib/server/auth/rate-limit';
import { createSession, SESSION_COOKIE } from '$lib/server/auth/sessions';

export const actions = {
  default: async (event) => {
    const config = getAppConfig();
    if (!config || config.authMode !== 'password') {
      return fail(400, { message: 'Password login is not enabled.' });
    }
    let ip = 'unknown';
    try {
      ip = event.getClientAddress();
    } catch {
      // Tests and local previews may not provide an address.
    }
    const limit = loginRateLimit(ip);
    if (!limit.allowed) {
      return fail(429, {
        message: `Too many login attempts. Try again in ${limit.retryAfterSeconds} seconds.`
      });
    }
    const form = await event.request.formData();
    const password = String(form.get('password') ?? '');
    if (!(await verifyPassword(password, config.passwordHash))) {
      recordLoginFailure(ip);
      return fail(400, { message: 'Incorrect password.' });
    }
    clearLoginFailures(ip);
    const session = createSession(config.passwordHash);
    event.cookies.set(SESSION_COOKIE, session.token, {
      path: '/',
      httpOnly: true,
      secure: config.origin.startsWith('https://'),
      sameSite: 'lax',
      expires: session.expiresAt
    });
    const requested = event.url.searchParams.get('returnTo') ?? '/';
    const returnTo = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/';
    throw redirect(303, returnTo);
  }
} satisfies Actions;
