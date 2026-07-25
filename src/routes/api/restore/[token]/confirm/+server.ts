import { error, type RequestHandler } from '@sveltejs/kit';
import { assertSameOrigin } from '$lib/server/security/origin';
import { confirmRestore } from '$lib/server/backup/restore';

export const POST: RequestHandler = async ({ params, request }) => {
  assertSameOrigin(request);
  const token = params.token;
  if (!token || !/^[a-f0-9-]{36}$/.test(token)) throw error(400, 'Invalid restore token');
  try {
    return Response.json({ pending: true, ...(await confirmRestore(token)) });
  } catch (restoreError) {
    return Response.json(
      {
        error: restoreError instanceof Error ? restoreError.message : 'Restore could not be staged'
      },
      { status: 400 }
    );
  }
};
