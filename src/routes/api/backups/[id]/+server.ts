import { error, type RequestHandler } from '@sveltejs/kit';
import { createReadStream } from 'node:fs';
import { rm, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { assertSameOrigin } from '$lib/server/security/origin';
import { backupPath } from '$lib/server/backup/create';

export const GET: RequestHandler = async ({ params }) => {
  const id = params.id;
  if (!id) throw error(400, 'Invalid backup ID');
  try {
    const path = backupPath(id);
    const info = await stat(path);
    return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, {
      headers: {
        'content-type': 'application/zip',
        'content-length': String(info.size),
        'content-disposition': `attachment; filename="${id}"`,
        'cache-control': 'no-store'
      }
    });
  } catch {
    throw error(404, 'Backup not found');
  }
};

export const DELETE: RequestHandler = async ({ params, request }) => {
  assertSameOrigin(request);
  const id = params.id;
  if (!id) throw error(400, 'Invalid backup ID');
  try {
    await rm(backupPath(id));
    return new Response(null, { status: 204 });
  } catch {
    throw error(404, 'Backup not found');
  }
};
