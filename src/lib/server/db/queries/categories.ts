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
}

export function mapCategory(row: CategoryRow): CategoryDTO {
  return {
    id: row.id,
    name: row.name,
    iconName: row.icon_name,
    iconSvg: categoryIconSvg(row.icon_name),
    color: row.color,
    sortOrder: row.sort_order,
    isSystem: row.is_system === 1
  };
}

export function listCategories(database: DatabaseSync = getDatabase()): CategoryDTO[] {
  const rows = database
    .prepare(
      `SELECT id, name, icon_name, color, sort_order, is_system
       FROM categories
       ORDER BY sort_order, name COLLATE NOCASE`
    )
    .all() as unknown as CategoryRow[];
  return rows.map(mapCategory);
}

export function categoryExists(id: string, database: DatabaseSync = getDatabase()): boolean {
  return Boolean(database.prepare('SELECT 1 FROM categories WHERE id = ?').get(id));
}
