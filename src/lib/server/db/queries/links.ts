import type { DatabaseSync } from 'node:sqlite';
import type { PlaceLinkDTO } from '$lib/types';
import { getDatabase } from '../driver';

interface LinkRow {
  id: string;
  place_id?: string;
  title: string | null;
  url: string;
  sort_order: number;
  created_at: string;
}

function mapLink(row: LinkRow): PlaceLinkDTO {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    sortOrder: row.sort_order,
    createdAt: row.created_at
  };
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
  return rows.map(mapLink);
}

export function allLinksByPlace(
  database: DatabaseSync = getDatabase()
): Map<string, PlaceLinkDTO[]> {
  const rows = database
    .prepare(
      `SELECT id, place_id, title, url, sort_order, created_at
       FROM place_links
       ORDER BY place_id, sort_order, created_at, id`
    )
    .all() as unknown as LinkRow[];
  const links = new Map<string, PlaceLinkDTO[]>();
  for (const row of rows) {
    if (!row.place_id) continue;
    const values = links.get(row.place_id) ?? [];
    values.push(mapLink(row));
    links.set(row.place_id, values);
  }
  return links;
}
