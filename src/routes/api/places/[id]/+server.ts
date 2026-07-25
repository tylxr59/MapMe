import { error, type RequestHandler } from '@sveltejs/kit';
import { uuidSchema } from '$lib/schemas/common';
import { getPlace } from '$lib/server/db/queries/places';

export const GET: RequestHandler = ({ params }) => {
  const id = uuidSchema.safeParse(params.id);
  if (!id.success) throw error(400, 'Invalid place ID');
  const place = getPlace(id.data);
  if (!place) throw error(404, 'Place not found');
  return Response.json({ place });
};
