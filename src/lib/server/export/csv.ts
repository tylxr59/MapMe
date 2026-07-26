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
    list: place.list.name,
    links: JSON.stringify(
      place.links.map((link) => ({
        title: link.title,
        url: link.url
      }))
    ),
    favorite: place.isFavorite,
    archived: place.isArchived,
    rating: place.rating ?? '',
    date_visited: place.dateVisited ?? '',
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
      'list',
      'links',
      'favorite',
      'archived',
      'rating',
      'date_visited',
      'created_at',
      'updated_at'
    ]
  });
}
