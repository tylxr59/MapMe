import { error, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { privateConfig } from '$lib/server/config/private';
import { nominatimProvider } from '$lib/server/geocoding/nominatim';

const coordinatesSchema = z.object({
  latitude: z.coerce.number().finite().min(-90).max(90),
  longitude: z.coerce.number().finite().min(-180).max(180)
});

export const GET: RequestHandler = async ({ url }) => {
  if (!privateConfig.geocodingEnabled) throw error(404, 'Geocoding is disabled');
  const coordinates = coordinatesSchema.safeParse({
    latitude: url.searchParams.get('lat'),
    longitude: url.searchParams.get('lng')
  });
  if (!coordinates.success) throw error(400, 'Invalid coordinates');
  try {
    return Response.json({
      results: await nominatimProvider.reverse(
        coordinates.data.latitude,
        coordinates.data.longitude
      )
    });
  } catch {
    return Response.json(
      { error: 'The geocoding provider is temporarily unavailable' },
      { status: 502 }
    );
  }
};
