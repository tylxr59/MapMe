import { describe, expect, it } from 'vitest';
import { placeInputSchema } from '$lib/schemas/place';
import { filtersSchema } from '$lib/schemas/filters';
import { safeFtsQuery } from '$lib/server/db/queries/search';
import { categoryIconSvg, isValidCategoryIcon } from '$lib/icons/category-icons';
import { safeStoragePath } from '$lib/server/storage/paths';

const validPlace = {
  name: 'A place',
  latitude: 40.7,
  longitude: -74,
  categoryId: '00000000-0000-4000-8000-000000000008',
  tagIds: [],
  status: 'saved',
  isFavorite: false,
  isArchived: false,
  rating: null,
  address: null,
  description: null,
  dateVisited: null,
  sourceUrl: null,
  extraProperties: {}
};

describe('place validation', () => {
  it('accepts a valid point place', () => {
    expect(placeInputSchema.parse(validPlace).name).toBe('A place');
  });

  it('rejects invalid coordinates and unsafe URL schemes', () => {
    expect(
      placeInputSchema.safeParse({ ...validPlace, latitude: 91, sourceUrl: 'javascript:alert(1)' })
        .success
    ).toBe(false);
  });

  it('normalizes empty optional values', () => {
    const parsed = placeInputSchema.parse({ ...validPlace, address: '', rating: '' });
    expect(parsed.address).toBeNull();
    expect(parsed.rating).toBeNull();
  });
});

describe('filter validation', () => {
  it('parses typed comma-separated filters', () => {
    const parsed = filtersSchema.parse({
      statuses: 'saved,visited',
      categoryIds: '00000000-0000-4000-8000-000000000008',
      archived: 'true'
    });
    expect(parsed.statuses).toEqual(['saved', 'visited']);
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

  it('rejects filenames and traversal paths outside generated storage names', () => {
    expect(() => safeStoragePath('/tmp/uploads', '../../secret')).toThrow('Unsafe storage name');
    expect(safeStoragePath('/tmp/uploads', '123e4567-e89b-42d3-a456-426614174000.webp')).toBe(
      '/tmp/uploads/123e4567-e89b-42d3-a456-426614174000.webp'
    );
  });
});
