import { allPlaceDetails as queryAllPlaceDetails } from '$lib/server/db/queries/places';

export function allPlaceDetails() {
  return queryAllPlaceDetails();
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
      list: place.list.name,
      listId: place.list.id,
      links: place.links.map((link) => ({ title: link.title, url: link.url })),
      favorite: place.isFavorite,
      archived: place.isArchived,
      rating: place.rating,
      dateVisited: place.dateVisited,
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
