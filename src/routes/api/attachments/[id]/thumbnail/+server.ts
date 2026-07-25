import { error, type RequestHandler } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { uuidSchema } from '$lib/schemas/common';
import { attachmentById } from '$lib/server/db/queries/attachments';
import { safeStoragePath, storagePaths } from '$lib/server/storage/paths';

export const GET: RequestHandler = async ({ params }) => {
  const id = uuidSchema.safeParse(params.id);
  if (!id.success) throw error(400, 'Invalid photo ID');
  const photo = attachmentById(id.data);
  if (!photo) throw error(404, 'Photo not found');
  try {
    return new Response(
      await readFile(safeStoragePath(storagePaths.thumbnails, photo.thumbnail_storage_name)),
      {
        headers: {
          'content-type': 'image/webp',
          'cache-control': 'private, max-age=31536000, immutable',
          'x-content-type-options': 'nosniff'
        }
      }
    );
  } catch {
    throw error(404, 'Photo file not found');
  }
};
