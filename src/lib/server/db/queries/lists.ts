import type { DatabaseSync } from 'node:sqlite';
import type { PlaceListDTO } from '$lib/types';
import { getDatabase } from '../driver';

interface ListRow {
  id: string;
  name: string;
  sort_order: number;
  is_system: number;
  place_count?: number;
}

export function mapList(row: ListRow): PlaceListDTO {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isSystem: row.is_system === 1,
    placeCount: row.place_count
  };
}

export function listPlaceLists(database: DatabaseSync = getDatabase()): PlaceListDTO[] {
  const rows = database
    .prepare(
      `SELECT
         l.id, l.name, l.sort_order, l.is_system,
         (SELECT count(*) FROM places p WHERE p.list_id = l.id) AS place_count
       FROM lists l
       ORDER BY l.is_system, l.name COLLATE NOCASE`
    )
    .all() as unknown as ListRow[];
  return rows.map(mapList);
}

export function placeListExists(id: string, database: DatabaseSync = getDatabase()): boolean {
  return Boolean(database.prepare('SELECT 1 FROM lists WHERE id = ?').get(id));
}
