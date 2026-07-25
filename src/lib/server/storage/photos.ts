import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { rename, rm } from 'node:fs/promises';
import { fileTypeFromFile } from 'file-type';
import sharp from 'sharp';
import type { AttachmentDTO } from '$lib/types';
import { getDatabase } from '$lib/server/db/driver';
import { transaction } from '$lib/server/db/transaction';
import { mapAttachment, type AttachmentRow } from '$lib/server/db/queries/attachments';
import { privateConfig } from '$lib/server/config/private';
import { safeStoragePath, storagePaths } from './paths';
import type { StagedUpload } from './uploads';
import { mutationLock } from '$lib/server/mutation-lock';

const acceptedTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp']
]);

export async function processPhoto(placeId: string, staged: StagedUpload): Promise<AttachmentDTO> {
  return mutationLock.runExclusive(() => processPhotoUnlocked(placeId, staged));
}

async function processPhotoUnlocked(placeId: string, staged: StagedUpload): Promise<AttachmentDTO> {
  const database = getDatabase();
  if (!database.prepare('SELECT 1 FROM places WHERE id = ?').get(placeId))
    throw new Error('Place not found');
  const count = database
    .prepare('SELECT count(*) AS count FROM attachments WHERE place_id = ?')
    .get(placeId) as { count: number };
  if (count.count >= privateConfig.uploadMaxFilesPerPlace) {
    throw new Error(`A place may have at most ${privateConfig.uploadMaxFilesPerPlace} photos`);
  }

  let originalPath: string | null = null;
  let thumbnailPath: string | null = null;
  try {
    const detected = await fileTypeFromFile(staged.path);
    const extension = detected ? acceptedTypes.get(detected.mime) : undefined;
    if (!detected || !extension) throw new Error('Only JPEG, PNG, and WebP photos are accepted');
    if (
      staged.declaredMime &&
      staged.declaredMime !== 'application/octet-stream' &&
      staged.declaredMime !== detected.mime
    ) {
      throw new Error('The declared photo type does not match its contents');
    }
    const image = sharp(staged.path, {
      failOn: 'error',
      limitInputPixels: 40_000_000,
      sequentialRead: true,
      animated: false
    });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) throw new Error('Photo dimensions could not be read');
    if ((metadata.pages ?? 1) > 1)
      throw new Error('Animated and multi-page images are not accepted');

    const id = randomUUID();
    const storageName = `${randomUUID()}.${extension}`;
    const thumbnailStorageName = `${randomUUID()}.webp`;
    originalPath = safeStoragePath(storagePaths.originals, storageName);
    thumbnailPath = safeStoragePath(storagePaths.thumbnails, thumbnailStorageName);
    await sharp(staged.path, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toFile(thumbnailPath);
    await rename(staged.path, originalPath);
    const sha256 = createHash('sha256')
      .update(await readFile(originalPath))
      .digest('hex');
    const now = new Date().toISOString();
    const row = transaction((db) => {
      const order = db
        .prepare(
          'SELECT coalesce(max(sort_order), -1) + 1 AS next_order FROM attachments WHERE place_id = ?'
        )
        .get(placeId) as { next_order: number };
      db.prepare(
        `INSERT INTO attachments (
           id, place_id, storage_name, thumbnail_storage_name, original_name, media_type,
           size_bytes, width, height, sha256, sort_order, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        placeId,
        storageName,
        thumbnailStorageName,
        staged.originalName,
        detected.mime,
        staged.bytes,
        metadata.width,
        metadata.height,
        sha256,
        order.next_order,
        now
      );
      return db
        .prepare('SELECT * FROM attachments WHERE id = ?')
        .get(id) as unknown as AttachmentRow;
    });
    return mapAttachment(row);
  } catch (error) {
    if (originalPath) await rm(originalPath, { force: true }).catch(() => undefined);
    if (thumbnailPath) await rm(thumbnailPath, { force: true }).catch(() => undefined);
    throw error;
  } finally {
    await rm(staged.path, { force: true }).catch(() => undefined);
  }
}

export async function removePhoto(id: string): Promise<void> {
  return mutationLock.runExclusive(() => removePhotoUnlocked(id));
}

async function removePhotoUnlocked(id: string): Promise<void> {
  const row = transaction((database) => {
    const attachment = database.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as
      AttachmentRow | undefined;
    if (!attachment) throw new Error('Photo not found');
    database.prepare('DELETE FROM attachments WHERE id = ?').run(id);
    return attachment;
  });
  await Promise.all([
    rm(safeStoragePath(storagePaths.originals, row.storage_name), { force: true }),
    rm(safeStoragePath(storagePaths.thumbnails, row.thumbnail_storage_name), { force: true })
  ]);
}
