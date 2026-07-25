import type { RequestHandler } from './$types';
import { exportCsv } from '$lib/server/export/csv';

export const GET: RequestHandler = () =>
  new Response(exportCsv(), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="mapme-places.csv"',
      'cache-control': 'no-store'
    }
  });
