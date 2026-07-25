import type { DatabaseSync } from 'node:sqlite';
import type { TagDTO } from '$lib/types';
import { getDatabase } from '../driver';

interface TagRow {
  id: string;
  name: string;
  place_count: number;
}

export function listTags(database: DatabaseSync = getDatabase()): TagDTO[] {
  const rows = database
    .prepare(
      `SELECT t.id, t.name, count(pt.place_id) AS place_count
       FROM tags t
       LEFT JOIN place_tags pt ON pt.tag_id = t.id
       GROUP BY t.id
       ORDER BY t.name COLLATE NOCASE`
    )
    .all() as unknown as TagRow[];
  return rows.map((row) => ({ id: row.id, name: row.name, placeCount: row.place_count }));
}

export function tagsForPlaces(
  placeIds: string[],
  database: DatabaseSync = getDatabase()
): Map<string, TagDTO[]> {
  const result = new Map<string, TagDTO[]>();
  for (const id of placeIds) result.set(id, []);
  if (placeIds.length === 0) return result;
  const placeholders = placeIds.map(() => '?').join(',');
  const rows = database
    .prepare(
      `SELECT pt.place_id, t.id, t.name
       FROM place_tags pt
       JOIN tags t ON t.id = pt.tag_id
       WHERE pt.place_id IN (${placeholders})
       ORDER BY t.name COLLATE NOCASE`
    )
    .all(...placeIds) as unknown as Array<{ place_id: string; id: string; name: string }>;
  for (const row of rows) {
    result.get(row.place_id)?.push({ id: row.id, name: row.name });
  }
  return result;
}

export function tagNamesForPlace(placeId: string, database: DatabaseSync = getDatabase()): string {
  const row = database
    .prepare(
      `SELECT coalesce(group_concat(name, ' '), '') AS names
       FROM (
         SELECT t.name
         FROM place_tags pt
         JOIN tags t ON t.id = pt.tag_id
         WHERE pt.place_id = ?
         ORDER BY t.name COLLATE NOCASE
       )`
    )
    .get(placeId) as { names: string };
  return row.names;
}
