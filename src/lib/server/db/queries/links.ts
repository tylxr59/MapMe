import type { DatabaseSync } from 'node:sqlite';
import type { PlaceLinkDTO } from '$lib/types';
import { getDatabase } from '../driver';

interface LinkRow {
  id: string;
  title: string | null;
  url: string;
  sort_order: number;
  created_at: string;
}

export function linksForPlace(
  placeId: string,
  database: DatabaseSync = getDatabase()
): PlaceLinkDTO[] {
  const rows = database
    .prepare(
      `SELECT id, title, url, sort_order, created_at
       FROM place_links
       WHERE place_id = ?
       ORDER BY sort_order, created_at, id`
    )
    .all(placeId) as unknown as LinkRow[];
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    url: row.url,
    sortOrder: row.sort_order,
    createdAt: row.created_at
  }));
}
