import { stringify } from 'csv-stringify/sync';
import { allPlaceDetails } from './geojson';

export function exportCsv(): string {
  const records = allPlaceDetails().map((place) => ({
    id: place.id,
    name: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    address: place.address ?? '',
    description: place.description ?? '',
    category: place.category.name,
    status: place.status,
    favorite: place.isFavorite,
    archived: place.isArchived,
    rating: place.rating ?? '',
    date_visited: place.dateVisited ?? '',
    source_url: place.sourceUrl ?? '',
    created_at: place.createdAt,
    updated_at: place.updatedAt
  }));
  return stringify(records, {
    header: true,
    columns: [
      'id',
      'name',
      'latitude',
      'longitude',
      'address',
      'description',
      'category',
      'status',
      'favorite',
      'archived',
      'rating',
      'date_visited',
      'source_url',
      'created_at',
      'updated_at'
    ]
  });
}
