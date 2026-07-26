import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { hashPassword } from '$lib/server/auth/password';
import { createSession, SESSION_COOKIE } from '$lib/server/auth/sessions';
import {
  appConfigSchema,
  completeSetup,
  parseTrustedCidrs,
  requestOrigin,
  suggestedAppConfig
} from '$lib/server/config/app';

export const load: PageServerLoad = ({ request }) => {
  const suggested = suggestedAppConfig(requestOrigin(request));
  return {
    origin: suggested.origin,
    authMode: process.env.AUTH_MODE ? suggested.authMode : 'password',
    proxyHeader: suggested.proxyHeader,
    proxyTrustedCidrs: suggested.proxyTrustedCidrs.join(', ')
  };
};

export const actions = {
  default: async (event) => {
    const form = await event.request.formData();
    const origin = String(form.get('origin') ?? '').trim();
    const authMode = String(form.get('authMode') ?? '');
    const password = String(form.get('password') ?? '');
    const passwordConfirm = String(form.get('passwordConfirm') ?? '');
    const bootstrap = suggestedAppConfig(requestOrigin(event.request));

    if (authMode === 'password' && password !== passwordConfirm) {
      return fail(400, {
        message: 'The passwords do not match.',
        values: { origin, authMode, proxyHeader: '', proxyTrustedCidrs: '' }
      });
    }

    let passwordHash = bootstrap.passwordHash;
    if (authMode === 'password' && password) {
      try {
        passwordHash = await hashPassword(password);
      } catch (error) {
        return fail(400, {
          message: error instanceof Error ? error.message : 'Could not secure the password.',
          values: { origin, authMode, proxyHeader: '', proxyTrustedCidrs: '' }
        });
      }
    }

    const proxyHeader = String(form.get('proxyHeader') ?? 'Remote-User').trim();
    const proxyTrustedCidrs = String(form.get('proxyTrustedCidrs') ?? '');
    const parsed = appConfigSchema.safeParse({
      version: 1,
      origin,
      authMode,
      passwordHash,
      proxyHeader,
      proxyTrustedCidrs: parseTrustedCidrs(proxyTrustedCidrs)
    });
    if (!parsed.success) {
      return fail(400, {
        message: parsed.error.issues[0]?.message ?? 'Check the setup fields.',
        values: { origin, authMode, proxyHeader, proxyTrustedCidrs }
      });
    }

    let config;
    try {
      config = completeSetup(parsed.data);
    } catch (error) {
      return fail(409, {
        message: error instanceof Error ? error.message : 'MapMe setup is already complete.',
        values: { origin, authMode, proxyHeader, proxyTrustedCidrs }
      });
    }
    if (config.authMode === 'password') {
      const session = createSession(config.passwordHash);
      event.cookies.set(SESSION_COOKIE, session.token, {
        path: '/',
        httpOnly: true,
        secure: config.origin.startsWith('https://'),
        sameSite: 'lax',
        expires: session.expiresAt
      });
    }
    throw redirect(303, '/');
  }
} satisfies Actions;
