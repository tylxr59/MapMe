import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import type { DatabaseSync } from 'node:sqlite';
import { normalizeName } from '$lib/schemas/common';
import type { ValidatedPlaceInput } from '$lib/schemas/place';
import type { PlaceDetail } from '$lib/types';
import { transaction } from '$lib/server/db/transaction';
import { getPlace } from '$lib/server/db/queries/places';
import { categoryExists } from '$lib/server/db/queries/categories';
import { refreshPlaceSearch } from '$lib/server/db/queries/search';
import { storagePaths, safeStoragePath } from '$lib/server/storage/paths';
import { mutationLock } from '$lib/server/mutation-lock';

export function insertPlace(
  database: DatabaseSync,
  input: ValidatedPlaceInput,
  id = input.id ?? randomUUID(),
  now = new Date().toISOString()
): string {
  if (!categoryExists(input.categoryId, database)) throw new Error('Category does not exist');
  database
    .prepare(
      `INSERT INTO places (
        id, name, normalized_name, latitude, longitude, address, description, category_id,
        status, is_favorite, is_archived, rating, date_visited, source_url,
        extra_properties_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.name,
      normalizeName(input.name),
      input.latitude,
      input.longitude,
      input.address ?? null,
      input.description ?? null,
      input.categoryId,
      input.status,
      input.isFavorite ? 1 : 0,
      input.isArchived ? 1 : 0,
      input.rating ?? null,
      input.dateVisited ?? null,
      input.sourceUrl ?? null,
      JSON.stringify(input.extraProperties ?? {}),
      now,
      now
    );
  refreshPlaceSearch(id, database);
  return id;
}

export function createPlace(input: ValidatedPlaceInput): PlaceDetail {
  const id = input.id ?? randomUUID();
  const now = new Date().toISOString();
  transaction((database) => {
    insertPlace(database, input, id, now);
  });
  return getPlace(id)!;
}

export function updatePlace(id: string, input: ValidatedPlaceInput): PlaceDetail {
  const now = new Date().toISOString();
  transaction((database) => {
    if (!categoryExists(input.categoryId, database)) throw new Error('Category does not exist');
    const result = database
      .prepare(
        `UPDATE places SET
          name = ?, normalized_name = ?, latitude = ?, longitude = ?, address = ?,
          description = ?, category_id = ?, status = ?, is_favorite = ?, is_archived = ?,
          rating = ?, date_visited = ?, source_url = ?, extra_properties_json = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        input.name,
        normalizeName(input.name),
        input.latitude,
        input.longitude,
        input.address ?? null,
        input.description ?? null,
        input.categoryId,
        input.status,
        input.isFavorite ? 1 : 0,
        input.isArchived ? 1 : 0,
        input.rating ?? null,
        input.dateVisited ?? null,
        input.sourceUrl ?? null,
        JSON.stringify(input.extraProperties ?? {}),
        now,
        id
      );
    if (result.changes !== 1) throw new Error('Place not found');
    refreshPlaceSearch(id, database);
  });
  return getPlace(id)!;
}

export async function deletePlace(id: string): Promise<void> {
  return mutationLock.runExclusive(() => deletePlaceUnlocked(id));
}

async function deletePlaceUnlocked(id: string): Promise<void> {
  const files = transaction((database) => {
    const rows = database
      .prepare('SELECT storage_name, thumbnail_storage_name FROM attachments WHERE place_id = ?')
      .all(id) as unknown as Array<{ storage_name: string; thumbnail_storage_name: string }>;
    database.prepare('DELETE FROM place_fts WHERE place_id = ?').run(id);
    const result = database.prepare('DELETE FROM places WHERE id = ?').run(id);
    if (result.changes !== 1) throw new Error('Place not found');
    return rows;
  });
  for (const file of files) {
    await Promise.all([
      rm(safeStoragePath(storagePaths.originals, file.storage_name), { force: true }),
      rm(safeStoragePath(storagePaths.thumbnails, file.thumbnail_storage_name), { force: true })
    ]).catch((error) => console.error('Could not remove deleted place attachment', error));
  }
}
