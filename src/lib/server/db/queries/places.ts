import type { DatabaseSync } from 'node:sqlite';
import type { PlaceDetail, PlaceFilters, PlaceSummary, PlaceStatus } from '$lib/types';
import { getDatabase } from '../driver';
import { attachmentsForPlace } from './attachments';
import { mapCategory } from './categories';
import { safeFtsQuery } from './search';

interface PlaceRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  description?: string | null;
  category_id: string;
  category_name: string;
  icon_name: string;
  color: string;
  sort_order: number;
  is_system: number;
  status: PlaceStatus;
  is_favorite: number;
  is_archived: number;
  rating: number | null;
  date_visited: string | null;
  source_url?: string | null;
  extra_properties_json?: string;
  created_at?: string;
  updated_at: string;
  attachment_count: number;
}

function mapSummary(row: PlaceRow): PlaceSummary {
  return {
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address,
    category: mapCategory({
      id: row.category_id,
      name: row.category_name,
      icon_name: row.icon_name,
      color: row.color,
      sort_order: row.sort_order,
      is_system: row.is_system
    }),
    status: row.status,
    isFavorite: row.is_favorite === 1,
    isArchived: row.is_archived === 1,
    rating: row.rating,
    dateVisited: row.date_visited,
    updatedAt: row.updated_at,
    attachmentCount: row.attachment_count
  };
}

const summarySelect = `
  SELECT
    p.id, p.name, p.latitude, p.longitude, p.address,
    p.category_id, c.name AS category_name, c.icon_name, c.color, c.sort_order, c.is_system,
    p.status, p.is_favorite, p.is_archived, p.rating, p.date_visited, p.updated_at,
    (SELECT count(*) FROM attachments a WHERE a.place_id = p.id) AS attachment_count
  FROM places p
  JOIN categories c ON c.id = p.category_id
`;

export function listPlaces(
  filters: PlaceFilters,
  database: DatabaseSync = getDatabase()
): PlaceSummary[] {
  const where: string[] = [];
  const values: Array<string | number> = [];

  if (filters.query) {
    const query = safeFtsQuery(filters.query);
    if (query) {
      where.push('p.id IN (SELECT place_id FROM place_fts WHERE place_fts MATCH ?)');
      values.push(query);
    }
  }
  if (filters.statuses.length > 0) {
    where.push(`p.status IN (${filters.statuses.map(() => '?').join(',')})`);
    values.push(...filters.statuses);
  }
  if (filters.categoryIds.length > 0) {
    where.push(`p.category_id IN (${filters.categoryIds.map(() => '?').join(',')})`);
    values.push(...filters.categoryIds);
  }
  if (filters.visited === 'visited')
    where.push("(p.status = 'visited' OR p.date_visited IS NOT NULL)");
  if (filters.visited === 'unvisited')
    where.push("(p.status != 'visited' AND p.date_visited IS NULL)");
  if (filters.favorite !== null) {
    where.push('p.is_favorite = ?');
    values.push(filters.favorite ? 1 : 0);
  }
  where.push('p.is_archived = ?');
  values.push(filters.archived ? 1 : 0);
  if (filters.ratingMin !== null) {
    where.push('p.rating >= ?');
    values.push(filters.ratingMin);
  }

  const sortSql = {
    updated_desc: 'p.updated_at DESC',
    name_asc: 'p.name COLLATE NOCASE ASC',
    rating_desc: 'p.rating DESC NULLS LAST, p.name COLLATE NOCASE ASC',
    visited_desc: 'p.date_visited DESC NULLS LAST, p.updated_at DESC'
  }[filters.sort];

  const sql = `${summarySelect}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${sortSql}
    LIMIT 10000`;
  const rows = database.prepare(sql).all(...values) as unknown as PlaceRow[];
  return rows.map(mapSummary);
}

export function getPlace(id: string, database: DatabaseSync = getDatabase()): PlaceDetail | null {
  const row = database
    .prepare(
      `SELECT
        p.*, c.name AS category_name, c.icon_name, c.color, c.sort_order, c.is_system,
        (SELECT count(*) FROM attachments a WHERE a.place_id = p.id) AS attachment_count
       FROM places p
       JOIN categories c ON c.id = p.category_id
       WHERE p.id = ?`
    )
    .get(id) as PlaceRow | undefined;
  if (!row) return null;
  const summary = mapSummary(row);
  let extraProperties: Record<string, unknown>;
  try {
    extraProperties = JSON.parse(row.extra_properties_json ?? '{}') as Record<string, unknown>;
  } catch {
    extraProperties = {};
  }
  return {
    ...summary,
    description: row.description ?? null,
    sourceUrl: row.source_url ?? null,
    extraProperties,
    createdAt: row.created_at ?? row.updated_at,
    attachments: attachmentsForPlace(id, database)
  };
}

export function findDuplicatePlace(
  normalizedName: string,
  latitude: number,
  longitude: number,
  database: DatabaseSync = getDatabase()
): { id: string; name: string; distanceMeters: number } | null {
  const candidates = database
    .prepare(
      `SELECT id, name, latitude, longitude
       FROM places
       WHERE normalized_name = ?
         AND latitude BETWEEN ? AND ?
         AND longitude BETWEEN ? AND ?`
    )
    .all(
      normalizedName,
      latitude - 0.001,
      latitude + 0.001,
      longitude - 0.001,
      longitude + 0.001
    ) as unknown as Array<{ id: string; name: string; latitude: number; longitude: number }>;
  for (const place of candidates) {
    const distanceMeters = haversineMeters(latitude, longitude, place.latitude, place.longitude);
    if (distanceMeters <= 50) return { id: place.id, name: place.name, distanceMeters };
  }
  return null;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
