import type { RequestHandler } from './$types';
import { filtersSchema } from '$lib/schemas/filters';
import { listPlaces } from '$lib/server/db/queries/places';

export const GET: RequestHandler = ({ url }) => {
  const filters = filtersSchema.parse({
    query: url.searchParams.get('q') ?? '',
    listIds: url.searchParams.get('lists') ?? '',
    categoryIds: url.searchParams.get('categories') ?? '',
    favorite: url.searchParams.get('favorite') ?? undefined,
    archived: url.searchParams.get('archived') ?? undefined,
    ratingMin: url.searchParams.get('ratingMin') ?? null,
    sort: url.searchParams.get('sort') ?? 'updated_desc'
  });
  return Response.json({ places: listPlaces(filters) });
};
