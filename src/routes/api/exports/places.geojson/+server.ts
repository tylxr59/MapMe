import type { RequestHandler } from './$types';
import { exportGeoJson } from '$lib/server/export/geojson';

export const GET: RequestHandler = () =>
  new Response(exportGeoJson(), {
    headers: {
      'content-type': 'application/geo+json; charset=utf-8',
      'content-disposition': 'attachment; filename="mapme-places.geojson"',
      'cache-control': 'no-store'
    }
  });
