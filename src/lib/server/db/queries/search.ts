import type { DatabaseSync } from 'node:sqlite';
import { getDatabase } from '../driver';

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
      `INSERT INTO place_fts (place_id, name, address, description)
       VALUES (?, ?, ?, ?)`
    )
    .run(placeId, place.name, place.address ?? '', place.description ?? '');
}

export function rebuildPlaceSearch(database: DatabaseSync = getDatabase()): number {
  database.exec('DELETE FROM place_fts');
  database.exec(`
    INSERT INTO place_fts (place_id, name, address, description)
    SELECT
      p.id,
      p.name,
      coalesce(p.address, ''),
      coalesce(p.description, '')
    FROM places p
  `);
  const row = database.prepare('SELECT count(*) AS count FROM place_fts').get() as {
    count: number;
  };
  return row.count;
}
