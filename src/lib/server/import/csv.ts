import { parse } from 'csv-parse/sync';
import type { RawImportCandidate } from './common';

const known = new Set([
  'id',
  'name',
  'latitude',
  'longitude',
  'address',
  'description',
  'category',
  'list',
  'links',
  'status',
  'favorite',
  'archived',
  'rating',
  'date_visited',
  'source_url',
  'tags',
  'created_at',
  'updated_at'
]);

export function parseCsvImport(content: string): RawImportCandidate[] {
  const rows = parse(content, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: false,
    max_record_size: 100_000
  }) as Array<Record<string, string>>;
  return rows.slice(0, 10_000).map((row, index) => ({
    sourceLabel: `Row ${index + 2}`,
    id: row.id || undefined,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address,
    description: row.description,
    category: row.category,
    list: row.list,
    links: row.links,
    status: row.status,
    favorite: row.favorite,
    archived: row.archived,
    rating: row.rating,
    dateVisited: row.date_visited,
    sourceUrl: row.source_url,
    extraProperties: Object.fromEntries(
      Object.entries(row)
        .filter(([key, value]) => !known.has(key) && value !== '')
        .map(([key, value]) => [`csv.${key}`, value])
    )
  }));
}
