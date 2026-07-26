import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { hashPassword } from '$lib/server/auth/password';
import { clearSessions, createSession, SESSION_COOKIE } from '$lib/server/auth/sessions';
import {
  appConfigSchema,
  getAppConfig,
  parseTrustedCidrs,
  requestOrigin,
  saveAppConfig
} from '$lib/server/config/app';

export const load: PageServerLoad = ({ request }) => {
  const config = getAppConfig();
  if (!config) throw new Error('MapMe setup is incomplete');
  return {
    origin: config.origin,
    currentOrigin: requestOrigin(request),
    authMode: config.authMode,
    proxyHeader: config.proxyHeader,
    proxyTrustedCidrs: config.proxyTrustedCidrs.join(', ')
  };
};

export const actions = {
  default: async (event) => {
    const current = getAppConfig();
    if (!current) return fail(409, { message: 'MapMe setup is incomplete.' });
    const form = await event.request.formData();
    const origin = String(form.get('origin') ?? '').trim();
    const authMode = String(form.get('authMode') ?? '');
    const password = String(form.get('password') ?? '');
    const passwordConfirm = String(form.get('passwordConfirm') ?? '');
    const proxyHeader = String(form.get('proxyHeader') ?? 'Remote-User').trim();
    const proxyTrustedCidrs = String(form.get('proxyTrustedCidrs') ?? '');

    if (password !== passwordConfirm) {
      return fail(400, { message: 'The passwords do not match.' });
    }

    let passwordHash = current.passwordHash;
    if (authMode === 'password' && password) {
      try {
        passwordHash = await hashPassword(password);
      } catch (error) {
        return fail(400, {
          message: error instanceof Error ? error.message : 'Could not secure the password.'
        });
      }
    }
    if (authMode === 'password' && !passwordHash.startsWith('$argon2id$')) {
      return fail(400, { message: 'Enter and confirm a password.' });
    }

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
        message: parsed.error.issues[0]?.message ?? 'Check the settings fields.'
      });
    }

    const authChanged =
      current.authMode !== parsed.data.authMode ||
      current.passwordHash !== parsed.data.passwordHash;
    const config = saveAppConfig(parsed.data);
    if (authChanged) clearSessions();

    if (config.authMode === 'password' && authChanged) {
      const session = createSession(config.passwordHash);
      event.cookies.set(SESSION_COOKIE, session.token, {
        path: '/',
        httpOnly: true,
        secure: config.origin.startsWith('https://'),
        sameSite: 'lax',
        expires: session.expiresAt
      });
    } else if (config.authMode !== 'password') {
      event.cookies.delete(SESSION_COOKIE, { path: '/' });
    }
    return { success: true, message: 'General settings saved.' };
  }
} satisfies Actions;
