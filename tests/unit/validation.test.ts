import { describe, expect, it } from 'vitest';
import { placeInputSchema } from '$lib/schemas/place';
import { filtersSchema } from '$lib/schemas/filters';
import { safeFtsQuery } from '$lib/server/db/queries/search';
import { safeLocalRedirect } from '$lib/server/security/redirect';
import {
  categoryIconSvg,
  isValidCategoryIcon,
  searchCategoryIcons
} from '$lib/icons/category-icons';
import { safeStoragePath } from '$lib/server/storage/paths';

const validPlace = {
  name: 'A place',
  latitude: 40.7,
  longitude: -74,
  categoryId: '00000000-0000-4000-8000-000000000008',
  listId: '00000000-0000-4000-8000-000000000101',
  isFavorite: false,
  isArchived: false,
  rating: null,
  address: null,
  description: null,
  dateVisited: null,
  links: [],
  extraProperties: {}
};

describe('place validation', () => {
  it('accepts a valid point place', () => {
    expect(placeInputSchema.parse(validPlace).name).toBe('A place');
  });

  it('rejects invalid coordinates and unsafe URL schemes', () => {
    expect(
      placeInputSchema.safeParse({
        ...validPlace,
        latitude: 91,
        links: [{ title: '', url: 'javascript:alert(1)' }]
      }).success
    ).toBe(false);
  });

  it('normalizes empty optional values', () => {
    const parsed = placeInputSchema.parse({ ...validPlace, address: '', rating: '' });
    expect(parsed.address).toBeNull();
    expect(parsed.rating).toBeNull();
  });

  it('rejects impossible calendar dates', () => {
    for (const dateVisited of ['2024-02-30', '2023-02-29', '2024-04-31', '0000-01-01']) {
      expect(placeInputSchema.safeParse({ ...validPlace, dateVisited }).success).toBe(false);
    }
    expect(placeInputSchema.safeParse({ ...validPlace, dateVisited: '2024-02-29' }).success).toBe(
      true
    );
  });
});

describe('filter validation', () => {
  it('parses typed comma-separated filters', () => {
    const parsed = filtersSchema.parse({
      listIds: '00000000-0000-4000-8000-000000000101,00000000-0000-4000-8000-000000000103',
      categoryIds: '00000000-0000-4000-8000-000000000008',
      archived: 'true'
    });
    expect(parsed.listIds).toEqual([
      '00000000-0000-4000-8000-000000000101',
      '00000000-0000-4000-8000-000000000103'
    ]);
    expect(parsed.archived).toBe(true);
  });
});

describe('FTS query construction', () => {
  it('quotes user tokens instead of accepting raw FTS syntax', () => {
    expect(safeFtsQuery('coffee" OR *')).toBe('"coffee"* AND "OR"*');
  });
});

describe('trusted icon and storage handling', () => {
  it('renders packaged Lucide icons and falls back for unknown names', () => {
    expect(isValidCategoryIcon('coffee')).toBe(true);
    expect(isValidCategoryIcon('<script>')).toBe(false);
    expect(categoryIconSvg('<script>')).toContain('<svg');
    expect(categoryIconSvg('<script>')).not.toContain('<script>');
  });

  it('finds place-oriented Lucide icons with fuzzy aliases', () => {
    expect(searchCategoryIcons('shooting range')).toContain('target');
    expect(searchCategoryIcons('overlanding')).toContain('truck');
    expect(searchCategoryIcons('urbex')).toContain('warehouse');
  });

  it('rejects filenames and traversal paths outside generated storage names', () => {
    expect(() => safeStoragePath('/tmp/uploads', '../../secret')).toThrow('Unsafe storage name');
    expect(safeStoragePath('/tmp/uploads', '123e4567-e89b-42d3-a456-426614174000.webp')).toBe(
      '/tmp/uploads/123e4567-e89b-42d3-a456-426614174000.webp'
    );
  });
});

describe('local redirect validation', () => {
  it('preserves local paths and rejects browser-normalized external targets', () => {
    const origin = 'https://places.example.com';
    expect(safeLocalRedirect('/manage/data?tab=backups', origin)).toBe('/manage/data?tab=backups');
    expect(safeLocalRedirect('//evil.example', origin)).toBe('/');
    expect(safeLocalRedirect('/\\evil.example', origin)).toBe('/');
    expect(safeLocalRedirect('https://evil.example', origin)).toBe('/');
  });
});
