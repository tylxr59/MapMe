import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteSession, SESSION_COOKIE } from '$lib/server/auth/sessions';

export const POST: RequestHandler = ({ cookies, locals }) => {
  if (locals.sessionToken) deleteSession(locals.sessionToken);
  cookies.delete(SESSION_COOKIE, { path: '/' });
  throw redirect(303, '/login');
};
