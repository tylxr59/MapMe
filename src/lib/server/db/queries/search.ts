import type { DatabaseSync } from 'node:sqlite';
import { getDatabase } from '../driver';
import { tagNamesForPlace } from './tags';

export function safeFtsQuery(query: string): string {
  return (query.normalize('NFKC').match(/[\p{L}\p{N}_]+/gu) ?? [])
    .slice(0, 20)
    .map((token) => `"${token.replaceAll('"', '""')}"*`)
    .join(' AND ');
}

export function refreshPlaceSearch(placeId: string, database: DatabaseSync = getDatabase()): void {
  const place = database
    .prepare('SELECT name, address, description FROM places WHERE id = ?')
    .get(placeId) as
    { name: string; address: string | null; description: string | null } | undefined;
  database.prepare('DELETE FROM place_fts WHERE place_id = ?').run(placeId);
  if (!place) return;
  database
    .prepare(
      `INSERT INTO place_fts (place_id, name, address, description, tags)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      placeId,
      place.name,
      place.address ?? '',
      place.description ?? '',
      tagNamesForPlace(placeId, database)
    );
}

export function rebuildPlaceSearch(database: DatabaseSync = getDatabase()): number {
  database.exec('DELETE FROM place_fts');
  database.exec(`
    INSERT INTO place_fts (place_id, name, address, description, tags)
    SELECT
      p.id,
      p.name,
      coalesce(p.address, ''),
      coalesce(p.description, ''),
      coalesce((
        SELECT group_concat(t.name, ' ')
        FROM place_tags pt
        JOIN tags t ON t.id = pt.tag_id
        WHERE pt.place_id = p.id
      ), '')
    FROM places p
  `);
  const row = database.prepare('SELECT count(*) AS count FROM place_fts').get() as {
    count: number;
  };
  return row.count;
}
