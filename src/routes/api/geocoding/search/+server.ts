import { error, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { privateConfig } from '$lib/server/config/private';
import { nominatimProvider } from '$lib/server/geocoding/nominatim';

const querySchema = z.string().trim().min(3).max(200);

export const GET: RequestHandler = async ({ url }) => {
  if (!privateConfig.geocodingEnabled) throw error(404, 'Geocoding is disabled');
  const query = querySchema.safeParse(url.searchParams.get('q'));
  if (!query.success) throw error(400, 'Search must contain between 3 and 200 characters');
  try {
    return Response.json(
      { results: await nominatimProvider.forward(query.data) },
      { headers: { 'cache-control': 'private, max-age=300' } }
    );
  } catch {
    return Response.json(
      { error: 'The geocoding provider is temporarily unavailable' },
      { status: 502 }
    );
  }
};
