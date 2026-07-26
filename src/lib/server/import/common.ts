import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizeName } from '$lib/schemas/common';
import { placeInputSchema } from '$lib/schemas/place';
import type {
  CategoryDTO,
  ImportPreview,
  ImportRecordResult,
  PlaceInput,
  PlaceLinkInput,
  PlaceListDTO
} from '$lib/types';
import { listCategories } from '$lib/server/db/queries/categories';
import { listPlaceLists } from '$lib/server/db/queries/lists';
import { findDuplicatePlace } from '$lib/server/db/queries/places';
import { getDatabase } from '$lib/server/db/driver';
import { storagePaths } from '$lib/server/storage/paths';
import { parseCsvImport } from './csv';
import { parseGeoJsonImport } from './geojson';
import { parseGpxImport } from './gpx';
import { parseKmlImport } from './kml';

export interface RawImportCandidate {
  sourceLabel: string;
  id?: string;
  name: unknown;
  latitude: unknown;
  longitude: unknown;
  address?: unknown;
  description?: unknown;
  category?: unknown;
  list?: unknown;
  status?: unknown;
  favorite?: unknown;
  archived?: unknown;
  rating?: unknown;
  dateVisited?: unknown;
  sourceUrl?: unknown;
  links?: unknown;
  extraProperties?: Record<string, unknown>;
  warnings?: string[];
}

export interface ParsedImport {
  format: 'geojson' | 'csv' | 'kml' | 'gpx';
  records: RawImportCandidate[];
}

export interface StagedImport {
  token: string;
  format: ParsedImport['format'];
  filename: string;
  sourcePath: string;
  previewPath: string;
}

const OTHER_CATEGORY_ID = '00000000-0000-4000-8000-000000000008';

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
}

function legacyStatusListName(value: unknown): string {
  const normalized = String(value ?? 'saved')
    .trim()
    .toLowerCase()
    .replaceAll(/[\s-]+/g, '_');
  return (
    {
      visited: 'Visited',
      want_to_go: 'Want to go',
      saved: 'Saved for later'
    }[normalized] ?? 'Saved for later'
  );
}

function categoryId(value: unknown, categories: CategoryDTO[]): string {
  const normalized = normalizeName(String(value ?? ''));
  return (
    categories.find(
      (category) => category.id === value || normalizeName(category.name) === normalized
    )?.id ?? OTHER_CATEGORY_ID
  );
}

function listId(value: unknown, legacyStatus: unknown, lists: PlaceListDTO[]): string {
  const requested = normalizeName(String(value ?? ''));
  const legacyName = normalizeName(legacyStatusListName(legacyStatus));
  return (
    lists.find((list) => list.id === value || normalizeName(list.name) === requested)?.id ??
    lists.find((list) => normalizeName(list.name) === legacyName)?.id ??
    lists.find((list) => list.isSystem)?.id ??
    lists[0]?.id
  );
}

function linkValues(value: unknown, sourceUrl: unknown): PlaceLinkInput[] {
  let parsed = value;
  if (typeof value === 'string' && value.trim()) {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = [];
    }
  }
  const links = Array.isArray(parsed)
    ? parsed.map((link) =>
        typeof link === 'string'
          ? { title: null, url: link }
          : {
              title:
                link && typeof link === 'object' && 'title' in link
                  ? String(link.title ?? '')
                  : null,
              url: link && typeof link === 'object' && 'url' in link ? String(link.url ?? '') : ''
            }
      )
    : [];
  if (sourceUrl) links.push({ title: null, url: String(sourceUrl) });
  return links;
}

export function parseImportSource(format: ParsedImport['format'], content: string): ParsedImport {
  if (format === 'geojson') return { format, records: parseGeoJsonImport(content) };
  if (format === 'csv') return { format, records: parseCsvImport(content) };
  if (format === 'gpx') return { format, records: parseGpxImport(content) };
  return { format, records: parseKmlImport(content) };
}

export function buildImportPreview(parsed: ParsedImport, token: string): ImportPreview {
  const categories = listCategories();
  const lists = listPlaceLists();
  const records: ImportRecordResult[] = parsed.records.slice(0, 10_000).map((raw, index) => {
    const candidate = {
      id: raw.id,
      name: raw.name,
      latitude: raw.latitude,
      longitude: raw.longitude,
      address: raw.address ?? null,
      description: raw.description ?? null,
      categoryId: categoryId(raw.category, categories),
      listId: listId(raw.list, raw.status, lists),
      isFavorite: booleanValue(raw.favorite),
      isArchived: booleanValue(raw.archived),
      rating: raw.rating === '' || raw.rating === undefined ? null : raw.rating,
      dateVisited: raw.dateVisited ?? null,
      links: linkValues(raw.links, raw.sourceUrl),
      extraProperties: raw.extraProperties ?? {}
    };
    const validation = placeInputSchema.safeParse(candidate);
    if (!validation.success) {
      return {
        index,
        sourceLabel: raw.sourceLabel,
        valid: false,
        warnings: raw.warnings ?? [],
        errors: validation.error.issues.map(
          (issue) => `${issue.path.join('.') || 'record'}: ${issue.message}`
        )
      };
    }
    const duplicate = findDuplicatePlace(
      normalizeName(validation.data.name),
      validation.data.latitude,
      validation.data.longitude
    );
    const idCollision =
      validation.data.id &&
      Boolean(getDatabase().prepare('SELECT 1 FROM places WHERE id = ?').get(validation.data.id));
    return {
      index,
      sourceLabel: raw.sourceLabel,
      valid: true,
      warnings: raw.warnings ?? [],
      errors: [],
      duplicateOf: idCollision
        ? {
            id: validation.data.id!,
            name: validation.data.name,
            reason: 'Stable ID already exists'
          }
        : duplicate
          ? {
              id: duplicate.id,
              name: duplicate.name,
              reason: `Same normalized name within ${Math.round(duplicate.distanceMeters)} meters`
            }
          : undefined,
      place: validation.data as PlaceInput
    };
  });
  return {
    token,
    format: parsed.format,
    total: records.length,
    valid: records.filter((record) => record.valid).length,
    invalid: records.filter((record) => !record.valid).length,
    duplicates: records.filter((record) => record.duplicateOf).length,
    records,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString()
  };
}

export async function stageImport(file: File): Promise<ImportPreview> {
  const extension = file.name.split('.').at(-1)?.toLowerCase();
  const format = extension === 'json' || extension === 'geojson' ? 'geojson' : extension;
  if (!['geojson', 'csv', 'kml', 'gpx'].includes(format ?? '')) {
    throw new Error('Use a .geojson, .json, .csv, .kml, or .gpx file');
  }
  const token = randomUUID();
  const directory = join(storagePaths.backupStaging, `import-${token}`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const sourcePath = join(directory, `source.${format}`);
  const previewPath = join(directory, 'preview.json');
  await writeFile(sourcePath, new Uint8Array(await file.arrayBuffer()), { mode: 0o600 });
  try {
    const parsed = parseImportSource(
      format as ParsedImport['format'],
      await readFile(sourcePath, 'utf8')
    );
    const preview = buildImportPreview(parsed, token);
    await writeFile(previewPath, JSON.stringify(preview), { mode: 0o600 });
    return preview;
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function readStagedImport(token: string): Promise<{
  parsed: ParsedImport;
  preview: ImportPreview;
  directory: string;
}> {
  if (!/^[a-f0-9-]{36}$/.test(token)) throw new Error('Invalid import token');
  const directory = join(storagePaths.backupStaging, `import-${token}`);
  const preview = JSON.parse(
    await readFile(join(directory, 'preview.json'), 'utf8')
  ) as ImportPreview;
  if (new Date(preview.expiresAt).getTime() < Date.now()) throw new Error('Import preview expired');
  const parsed = parseImportSource(
    preview.format,
    await readFile(join(directory, `source.${preview.format}`), 'utf8')
  );
  return { parsed, preview, directory };
}
