import { error, type RequestHandler } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { uuidSchema } from '$lib/schemas/common';
import { attachmentById } from '$lib/server/db/queries/attachments';
import { safeStoragePath, storagePaths } from '$lib/server/storage/paths';

function contentDispositionFilename(name: string): string {
  const fallback = name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100) || 'photo';
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export const GET: RequestHandler = async ({ params }) => {
  const id = uuidSchema.safeParse(params.id);
  if (!id.success) throw error(400, 'Invalid photo ID');
  const photo = attachmentById(id.data);
  if (!photo) throw error(404, 'Photo not found');
  try {
    return new Response(
      await readFile(safeStoragePath(storagePaths.originals, photo.storage_name)),
      {
        headers: {
          'content-type': photo.media_type,
          'content-disposition': contentDispositionFilename(photo.original_name),
          'cache-control': 'private, max-age=3600',
          'x-content-type-options': 'nosniff'
        }
      }
    );
  } catch {
    throw error(404, 'Photo file not found');
  }
};
