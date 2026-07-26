import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import type { DatabaseSync } from 'node:sqlite';
import { normalizeName } from '$lib/schemas/common';
import type { ValidatedPlaceInput } from '$lib/schemas/place';
import type { PlaceDetail } from '$lib/types';
import { transaction } from '$lib/server/db/transaction';
import { getPlace } from '$lib/server/db/queries/places';
import { categoryExists } from '$lib/server/db/queries/categories';
import { placeListExists } from '$lib/server/db/queries/lists';
import { refreshPlaceSearch } from '$lib/server/db/queries/search';
import { getDatabase } from '$lib/server/db/driver';
import { storagePaths, safeStoragePath } from '$lib/server/storage/paths';
import { mutationLock } from '$lib/server/mutation-lock';

function replacePlaceLinks(
  database: DatabaseSync,
  placeId: string,
  links: ValidatedPlaceInput['links'],
  now: string
): void {
  database.prepare('DELETE FROM place_links WHERE place_id = ?').run(placeId);
  const insert = database.prepare(
    `INSERT INTO place_links (id, place_id, title, url, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const [index, link] of links.entries()) {
    insert.run(randomUUID(), placeId, link.title ?? null, link.url, index * 10, now);
  }
}

export function insertPlace(
  database: DatabaseSync,
  input: ValidatedPlaceInput,
  id = input.id ?? randomUUID(),
  now = new Date().toISOString()
): string {
  if (!categoryExists(input.categoryId, database)) throw new Error('Category does not exist');
  if (!placeListExists(input.listId, database)) throw new Error('List does not exist');
  database
    .prepare(
      `INSERT INTO places (
        id, name, normalized_name, latitude, longitude, address, description, category_id,
        list_id, is_favorite, is_archived, rating, date_visited,
        extra_properties_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      input.listId,
      input.isFavorite ? 1 : 0,
      input.isArchived ? 1 : 0,
      input.rating ?? null,
      input.dateVisited ?? null,
      JSON.stringify(input.extraProperties ?? {}),
      now,
      now
    );
  replacePlaceLinks(database, id, input.links, now);
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
    if (!placeListExists(input.listId, database)) throw new Error('List does not exist');
    const result = database
      .prepare(
        `UPDATE places SET
          name = ?, normalized_name = ?, latitude = ?, longitude = ?, address = ?,
          description = ?, category_id = ?, list_id = ?, is_favorite = ?, is_archived = ?,
          rating = ?, date_visited = ?, extra_properties_json = ?, updated_at = ?
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
        input.listId,
        input.isFavorite ? 1 : 0,
        input.isArchived ? 1 : 0,
        input.rating ?? null,
        input.dateVisited ?? null,
        JSON.stringify(input.extraProperties ?? {}),
        now,
        id
      );
    if (result.changes !== 1) throw new Error('Place not found');
    replacePlaceLinks(database, id, input.links, now);
    refreshPlaceSearch(id, database);
  });
  return getPlace(id)!;
}

export function setPlaceFavorite(id: string, isFavorite: boolean): PlaceDetail {
  const result = getDatabase()
    .prepare('UPDATE places SET is_favorite = ?, updated_at = ? WHERE id = ?')
    .run(isFavorite ? 1 : 0, new Date().toISOString(), id);
  if (result.changes !== 1) throw new Error('Place not found');
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
