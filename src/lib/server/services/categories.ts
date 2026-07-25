import { randomUUID } from 'node:crypto';
import { isValidCategoryIcon } from '$lib/icons/category-icons';
import { normalizeName } from '$lib/schemas/common';
import type { z } from 'zod';
import type { categorySchema } from '$lib/schemas/category';
import { transaction } from '$lib/server/db/transaction';
import { listCategories } from '$lib/server/db/queries/categories';

type CategoryInput = z.infer<typeof categorySchema>;

export function saveCategory(input: CategoryInput) {
  if (!isValidCategoryIcon(input.iconName)) throw new Error('Unknown Lucide icon');
  const id = input.id ?? randomUUID();
  const now = new Date().toISOString();
  transaction((database) => {
    if (input.id) {
      const result = database
        .prepare(
          `UPDATE categories SET
             name = ?, normalized_name = ?, icon_name = ?, color = ?, sort_order = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          input.name,
          normalizeName(input.name),
          input.iconName,
          input.color.toUpperCase(),
          input.sortOrder,
          now,
          id
        );
      if (result.changes !== 1) throw new Error('Category not found');
    } else {
      database
        .prepare(
          `INSERT INTO categories
             (id, name, normalized_name, icon_name, color, sort_order, is_system, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
        )
        .run(
          id,
          input.name,
          normalizeName(input.name),
          input.iconName,
          input.color.toUpperCase(),
          input.sortOrder,
          now,
          now
        );
    }
  });
  return listCategories().find((category) => category.id === id)!;
}

export function deleteCategory(id: string, replacementId: string): void {
  if (id === replacementId) throw new Error('Replacement must be a different category');
  transaction((database) => {
    const category = database.prepare('SELECT is_system FROM categories WHERE id = ?').get(id) as
      { is_system: number } | undefined;
    if (!category) throw new Error('Category not found');
    if (category.is_system === 1) throw new Error('The system Other category cannot be deleted');
    if (!database.prepare('SELECT 1 FROM categories WHERE id = ?').get(replacementId)) {
      throw new Error('Replacement category not found');
    }
    database
      .prepare('UPDATE places SET category_id = ?, updated_at = ? WHERE category_id = ?')
      .run(replacementId, new Date().toISOString(), id);
    database.prepare('DELETE FROM categories WHERE id = ?').run(id);
  });
}
