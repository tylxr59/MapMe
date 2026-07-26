import type { DatabaseSync } from 'node:sqlite';
import type { PlaceDetail, PlaceFilters, PlaceSummary } from '$lib/types';
import { getDatabase } from '../driver';
import { allAttachmentsByPlace, attachmentsForPlace } from './attachments';
import { mapCategory } from './categories';
import { allLinksByPlace, linksForPlace } from './links';
import { mapList } from './lists';
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
  list_id: string;
  list_name: string;
  list_sort_order: number;
  list_is_system: number;
  is_favorite: number;
  is_archived: number;
  rating: number | null;
  date_visited: string | null;
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
    list: mapList({
      id: row.list_id,
      name: row.list_name,
      sort_order: row.list_sort_order,
      is_system: row.list_is_system
    }),
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
    p.list_id, l.name AS list_name, l.sort_order AS list_sort_order,
    l.is_system AS list_is_system,
    p.is_favorite, p.is_archived, p.rating, p.date_visited, p.updated_at,
    (SELECT count(*) FROM attachments a WHERE a.place_id = p.id) AS attachment_count
  FROM places p
  JOIN categories c ON c.id = p.category_id
  JOIN lists l ON l.id = p.list_id
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
  if (filters.listIds.length > 0) {
    where.push(`p.list_id IN (${filters.listIds.map(() => '?').join(',')})`);
    values.push(...filters.listIds);
  }
  if (filters.categoryIds.length > 0) {
    where.push(`p.category_id IN (${filters.categoryIds.map(() => '?').join(',')})`);
    values.push(...filters.categoryIds);
  }
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
    rating_desc: 'p.rating DESC NULLS LAST, p.name COLLATE NOCASE ASC'
  }[filters.sort];

  const sql = `${summarySelect}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY p.is_favorite DESC, ${sortSql}
    LIMIT 10000`;
  const rows = database.prepare(sql).all(...values) as unknown as PlaceRow[];
  return rows.map(mapSummary);
}

export function getPlace(id: string, database: DatabaseSync = getDatabase()): PlaceDetail | null {
  const row = database
    .prepare(
      `SELECT
        p.*, c.name AS category_name, c.icon_name, c.color, c.sort_order, c.is_system,
        l.name AS list_name, l.sort_order AS list_sort_order, l.is_system AS list_is_system,
        (SELECT count(*) FROM attachments a WHERE a.place_id = p.id) AS attachment_count
       FROM places p
       JOIN categories c ON c.id = p.category_id
       JOIN lists l ON l.id = p.list_id
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
    links: linksForPlace(id, database),
    extraProperties,
    createdAt: row.created_at ?? row.updated_at,
    attachments: attachmentsForPlace(id, database)
  };
}

export function allPlaceDetails(database: DatabaseSync = getDatabase()): PlaceDetail[] {
  const rows = database
    .prepare(
      `SELECT
         p.*, c.name AS category_name, c.icon_name, c.color, c.sort_order, c.is_system,
         l.name AS list_name, l.sort_order AS list_sort_order, l.is_system AS list_is_system,
         0 AS attachment_count
       FROM places p
       JOIN categories c ON c.id = p.category_id
       JOIN lists l ON l.id = p.list_id
       ORDER BY p.name COLLATE NOCASE, p.id`
    )
    .all() as unknown as PlaceRow[];
  const links = allLinksByPlace(database);
  const attachments = allAttachmentsByPlace(database);
  return rows.map((row) => {
    const placeAttachments = attachments.get(row.id) ?? [];
    const summary = { ...mapSummary(row), attachmentCount: placeAttachments.length };
    let extraProperties: Record<string, unknown>;
    try {
      extraProperties = JSON.parse(row.extra_properties_json ?? '{}') as Record<string, unknown>;
    } catch {
      extraProperties = {};
    }
    return {
      ...summary,
      description: row.description ?? null,
      links: links.get(row.id) ?? [],
      extraProperties,
      createdAt: row.created_at ?? row.updated_at,
      attachments: placeAttachments
    };
  });
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
