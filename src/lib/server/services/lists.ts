import { randomUUID } from 'node:crypto';
import { normalizeName } from '$lib/schemas/common';
import type { z } from 'zod';
import type { listSchema } from '$lib/schemas/list';
import { transaction } from '$lib/server/db/transaction';
import { listPlaceLists } from '$lib/server/db/queries/lists';

type ListInput = z.infer<typeof listSchema>;

export function savePlaceList(input: ListInput) {
  const id = input.id ?? randomUUID();
  const now = new Date().toISOString();
  transaction((database) => {
    if (input.id) {
      const result = database
        .prepare(
          `UPDATE lists
           SET name = ?, normalized_name = ?, sort_order = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(input.name, normalizeName(input.name), input.sortOrder, now, id);
      if (result.changes !== 1) throw new Error('List not found');
    } else {
      database
        .prepare(
          `INSERT INTO lists
             (id, name, normalized_name, sort_order, is_system, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0, ?, ?)`
        )
        .run(id, input.name, normalizeName(input.name), input.sortOrder, now, now);
    }
  });
  return listPlaceLists().find((list) => list.id === id)!;
}

export function deletePlaceList(id: string, replacementId: string): void {
  if (id === replacementId) throw new Error('Replacement must be a different list');
  transaction((database) => {
    const list = database.prepare('SELECT is_system FROM lists WHERE id = ?').get(id) as
      { is_system: number } | undefined;
    if (!list) throw new Error('List not found');
    if (list.is_system === 1) throw new Error('The fallback list cannot be deleted');
    if (!database.prepare('SELECT 1 FROM lists WHERE id = ?').get(replacementId)) {
      throw new Error('Replacement list not found');
    }
    database
      .prepare('UPDATE places SET list_id = ?, updated_at = ? WHERE list_id = ?')
      .run(replacementId, new Date().toISOString(), id);
    database.prepare('DELETE FROM lists WHERE id = ?').run(id);
  });
}
