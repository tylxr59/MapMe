import { fail } from '@sveltejs/kit';
import { ZodError } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { formDataObject } from '$lib/schemas/common';
import { filtersSchema } from '$lib/schemas/filters';
import { placeFavoriteSchema, placeIdSchema, placeInputSchema } from '$lib/schemas/place';
import { listCategories } from '$lib/server/db/queries/categories';
import { listPlaceLists } from '$lib/server/db/queries/lists';
import { listPlaces } from '$lib/server/db/queries/places';
import {
  createPlace,
  deletePlace,
  setPlaceFavorite,
  updatePlace
} from '$lib/server/services/places';

export const load: PageServerLoad = ({ url }) => {
  const parsedFilters = filtersSchema.parse({
    query: url.searchParams.get('q') ?? '',
    listIds: url.searchParams.get('lists') ?? '',
    categoryIds: url.searchParams.get('categories') ?? '',
    favorite: url.searchParams.get('favorite') ?? undefined,
    archived: url.searchParams.get('archived') ?? undefined,
    ratingMin: url.searchParams.get('ratingMin') ?? null,
    sort: 'rating_desc'
  });
  return {
    categories: listCategories(),
    lists: listPlaceLists(),
    places: listPlaces(parsedFilters),
    filters: parsedFilters
  };
};

function validationFailure(error: unknown) {
  if (error instanceof ZodError) {
    return fail(400, {
      success: false,
      message: 'Please correct the highlighted fields.',
      issues: error.issues
    });
  }
  const message = error instanceof Error ? error.message : 'The operation could not be completed.';
  return fail(400, { success: false, message });
}

export const actions = {
  createPlace: async ({ request }) => {
    try {
      const input = placeInputSchema.parse(formDataObject(await request.formData()));
      const place = createPlace(input);
      return { success: true, operation: 'created', placeId: place.id };
    } catch (error) {
      return validationFailure(error);
    }
  },
  updatePlace: async ({ request }) => {
    try {
      const form = await request.formData();
      const id = placeIdSchema.parse({ id: form.get('id') }).id;
      const input = placeInputSchema.parse(formDataObject(form));
      updatePlace(id, input);
      return { success: true, operation: 'updated', placeId: id };
    } catch (error) {
      return validationFailure(error);
    }
  },
  favoritePlace: async ({ request }) => {
    try {
      const input = placeFavoriteSchema.parse(formDataObject(await request.formData()));
      setPlaceFavorite(input.id, input.isFavorite);
      return { success: true, operation: 'favorite-updated', placeId: input.id };
    } catch (error) {
      return validationFailure(error);
    }
  },
  deletePlace: async ({ request }) => {
    try {
      const form = await request.formData();
      const { id } = placeIdSchema.parse({ id: form.get('id') });
      await deletePlace(id);
      return { success: true, operation: 'deleted', placeId: id };
    } catch (error) {
      return validationFailure(error);
    }
  }
} satisfies Actions;
