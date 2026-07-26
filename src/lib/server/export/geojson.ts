import { getPlace, listPlaces } from '$lib/server/db/queries/places';
import type { PlaceFilters } from '$lib/types';

const filters = (archived: boolean): PlaceFilters => ({
  query: '',
  statuses: [],
  categoryIds: [],
  visited: 'any',
  favorite: null,
  archived,
  ratingMin: null,
  sort: 'name_asc'
});

export function allPlaceDetails() {
  return [...listPlaces(filters(false)), ...listPlaces(filters(true))]
    .map((place) => getPlace(place.id))
    .filter((place) => place !== null);
}

export function exportGeoJson(): string {
  const features = allPlaceDetails().map((place) => ({
    type: 'Feature',
    id: place.id,
    geometry: {
      type: 'Point',
      coordinates: [place.longitude, place.latitude]
    },
    properties: {
      ...place.extraProperties,
      id: place.id,
      name: place.name,
      address: place.address,
      description: place.description,
      category: place.category.name,
      categoryId: place.category.id,
      status: place.status,
      favorite: place.isFavorite,
      archived: place.isArchived,
      rating: place.rating,
      dateVisited: place.dateVisited,
      sourceUrl: place.sourceUrl,
      createdAt: place.createdAt,
      updatedAt: place.updatedAt,
      attachments: place.attachments.map((attachment) => ({
        id: attachment.id,
        originalName: attachment.originalName,
        mediaType: attachment.mediaType,
        sizeBytes: attachment.sizeBytes
      })),
      photosOmitted: place.attachments.length > 0
    }
  }));
  return JSON.stringify({ type: 'FeatureCollection', features }, null, 2);
}
