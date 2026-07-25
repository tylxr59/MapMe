import { randomUUID } from 'node:crypto';
import { normalizeName } from '$lib/schemas/common';
import { transaction } from '$lib/server/db/transaction';
import { refreshPlaceSearch } from '$lib/server/db/queries/search';
import { listTags } from '$lib/server/db/queries/tags';

export function saveTag(name: string, id?: string) {
  const tagId = id ?? randomUUID();
  const now = new Date().toISOString();
  transaction((database) => {
    const affected = id
      ? (database
          .prepare('SELECT place_id FROM place_tags WHERE tag_id = ?')
          .all(id) as unknown as Array<{ place_id: string }>)
      : [];
    if (id) {
      const result = database
        .prepare('UPDATE tags SET name = ?, normalized_name = ?, updated_at = ? WHERE id = ?')
        .run(name, normalizeName(name), now, id);
      if (result.changes !== 1) throw new Error('Tag not found');
    } else {
      database
        .prepare(
          'INSERT INTO tags (id, name, normalized_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run(tagId, name, normalizeName(name), now, now);
    }
    for (const row of affected) refreshPlaceSearch(row.place_id, database);
  });
  return listTags().find((tag) => tag.id === tagId)!;
}

export function deleteTag(id: string): void {
  transaction((database) => {
    const affected = database
      .prepare('SELECT place_id FROM place_tags WHERE tag_id = ?')
      .all(id) as unknown as Array<{ place_id: string }>;
    const result = database.prepare('DELETE FROM tags WHERE id = ?').run(id);
    if (result.changes !== 1) throw new Error('Tag not found');
    for (const row of affected) refreshPlaceSearch(row.place_id, database);
  });
}

export function mergeTags(sourceId: string, targetId: string): void {
  if (sourceId === targetId) throw new Error('Tags must be different');
  transaction((database) => {
    const affected = database
      .prepare('SELECT place_id FROM place_tags WHERE tag_id IN (?, ?)')
      .all(sourceId, targetId) as unknown as Array<{ place_id: string }>;
    database
      .prepare(
        `INSERT OR IGNORE INTO place_tags (place_id, tag_id, created_at)
         SELECT place_id, ?, ? FROM place_tags WHERE tag_id = ?`
      )
      .run(targetId, new Date().toISOString(), sourceId);
    const result = database.prepare('DELETE FROM tags WHERE id = ?').run(sourceId);
    if (result.changes !== 1) throw new Error('Source tag not found');
    for (const id of new Set(affected.map((row) => row.place_id))) {
      refreshPlaceSearch(id, database);
    }
  });
}
