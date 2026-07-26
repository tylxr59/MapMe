import type { RawImportCandidate } from './common';

const known = new Set([
  'id',
  'name',
  'address',
  'description',
  'category',
  'categoryId',
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
  const document = JSON.parse(content);
  if (!document || document.type !== 'FeatureCollection' || !Array.isArray(document.features)) {
    throw new Error('GeoJSON must be a FeatureCollection');
  }
  return document.features.slice(0, 10_000).map((feature: any, index: number) => {
    const properties =
      feature?.properties && typeof feature.properties === 'object' ? feature.properties : {};
    const coordinates = feature?.geometry?.coordinates;
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
        feature?.geometry?.type === 'Point' && Array.isArray(coordinates)
          ? coordinates[1]
          : undefined,
      longitude:
        feature?.geometry?.type === 'Point' && Array.isArray(coordinates)
          ? coordinates[0]
          : undefined,
      address: properties.address,
      description: properties.description,
      category: properties.categoryId ?? properties.category,
      status: properties.status,
      favorite: properties.favorite,
      archived: properties.archived,
      rating: properties.rating,
      dateVisited: properties.dateVisited,
      sourceUrl: properties.sourceUrl,
      extraProperties: extraSize <= 65_536 ? extraProperties : {},
      warnings: [
        ...(feature?.geometry?.type !== 'Point' ? ['Only Point geometries can be imported.'] : []),
        ...(extraSize > 65_536 ? ['Unknown properties exceeded 64 KiB and were discarded.'] : []),
        ...(properties.attachments?.length
          ? ['Photo metadata was present, but photo binaries are not imported.']
          : [])
      ]
    };
  });
}
