import type { DatabaseSync } from 'node:sqlite';
import { categoryIconSvg } from '$lib/icons/category-icons';
import type { CategoryDTO } from '$lib/types';
import { getDatabase } from '../driver';

interface CategoryRow {
  id: string;
  name: string;
  icon_name: string;
  color: string;
  sort_order: number;
  is_system: number;
  place_count?: number;
}

export function mapCategory(row: CategoryRow): CategoryDTO {
  return {
    id: row.id,
    name: row.name,
    iconName: row.icon_name,
    iconSvg: categoryIconSvg(row.icon_name),
    color: row.color,
    sortOrder: row.sort_order,
    isSystem: row.is_system === 1,
    placeCount: row.place_count
  };
}

export function listCategories(database: DatabaseSync = getDatabase()): CategoryDTO[] {
  const rows = database
    .prepare(
      `SELECT
         c.id, c.name, c.icon_name, c.color, c.sort_order, c.is_system,
         (SELECT count(*) FROM places p WHERE p.category_id = c.id) AS place_count
       FROM categories c
       ORDER BY c.sort_order, c.name COLLATE NOCASE`
    )
    .all() as unknown as CategoryRow[];
  return rows.map(mapCategory);
}

export function categoryExists(id: string, database: DatabaseSync = getDatabase()): boolean {
  return Boolean(database.prepare('SELECT 1 FROM categories WHERE id = ?').get(id));
}
