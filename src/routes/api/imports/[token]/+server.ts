import { error, type RequestHandler } from '@sveltejs/kit';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { assertSameOrigin } from '$lib/server/security/origin';
import { storagePaths } from '$lib/server/storage/paths';

export const DELETE: RequestHandler = async ({ params, request }) => {
  assertSameOrigin(request);
  const token = params.token;
  if (!token || !/^[a-f0-9-]{36}$/.test(token)) throw error(400, 'Invalid import token');
  await rm(join(storagePaths.backupStaging, `import-${token}`), {
    recursive: true,
    force: true
  });
  return new Response(null, { status: 204 });
};
