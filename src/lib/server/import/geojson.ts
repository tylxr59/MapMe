import type { RawImportCandidate } from './common';

const known = new Set([
  'id',
  'name',
  'address',
  'description',
  'category',
  'categoryId',
  'list',
  'listId',
  'links',
  'tags',
  'status',
  'favorite',
  'archived',
  'rating',
  'dateVisited',
  'sourceUrl',
  'createdAt',
  'updatedAt',
  'attachments',
  'photosOmitted'
]);

export function parseGeoJsonImport(content: string): RawImportCandidate[] {
  const value = JSON.parse(content) as unknown;
  const document =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : Object.create(null);
  if (document.type !== 'FeatureCollection' || !Array.isArray(document.features)) {
    throw new Error('GeoJSON must be a FeatureCollection');
  }
  return document.features.slice(0, 10_000).map((value: unknown, index: number) => {
    const feature =
      value && typeof value === 'object' ? (value as Record<string, unknown>) : Object.create(null);
    const geometry =
      feature.geometry && typeof feature.geometry === 'object'
        ? (feature.geometry as Record<string, unknown>)
        : Object.create(null);
    const properties =
      feature.properties && typeof feature.properties === 'object'
        ? (feature.properties as Record<string, unknown>)
        : Object.create(null);
    const coordinates = geometry.coordinates;
    const extraProperties = Object.fromEntries(
      Object.entries(properties).filter(([key]) => !known.has(key))
    );
    const extraSize = JSON.stringify(extraProperties).length;
    return {
      sourceLabel: `Feature ${index + 1}`,
      id:
        typeof properties.id === 'string'
          ? properties.id
          : typeof feature.id === 'string'
            ? feature.id
            : undefined,
      name: properties.name,
      latitude:
        geometry.type === 'Point' && Array.isArray(coordinates) ? coordinates[1] : undefined,
      longitude:
        geometry.type === 'Point' && Array.isArray(coordinates) ? coordinates[0] : undefined,
      address: properties.address,
      description: properties.description,
      category: properties.categoryId ?? properties.category,
      list: properties.listId ?? properties.list,
      links: properties.links,
      status: properties.status,
      favorite: properties.favorite,
      archived: properties.archived,
      rating: properties.rating,
      dateVisited: properties.dateVisited,
      sourceUrl: properties.sourceUrl,
      extraProperties: extraSize <= 65_536 ? extraProperties : {},
      warnings: [
        ...(geometry.type !== 'Point' ? ['Only Point geometries can be imported.'] : []),
        ...(extraSize > 65_536 ? ['Unknown properties exceeded 64 KiB and were discarded.'] : []),
        ...(Array.isArray(properties.attachments) && properties.attachments.length
          ? ['Photo metadata was present, but photo binaries are not imported.']
          : [])
      ]
    };
  });
}
