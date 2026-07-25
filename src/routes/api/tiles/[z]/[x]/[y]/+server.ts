import { error, type RequestHandler } from '@sveltejs/kit';
import packageJson from '../../../../../../../package.json';
import { privateConfig } from '$lib/server/config/private';
import { storagePaths } from '$lib/server/storage/paths';
import { originOnlyReferer, parseTileCoordinates, TileCache } from '$lib/server/tiles/cache';

const tileCache = new TileCache({
  directory: storagePaths.tileCache,
  maximumBytes: privateConfig.tileCacheMaxMb * 1024 * 1024,
  upstreamTemplate: privateConfig.tileUrl,
  userAgent: `MapMe/${packageJson.version} (+https://github.com/tylxr59/MapMe)`
});

function etagMatches(header: string | null, etag: string | null): boolean {
  if (!header || !etag) return false;
  return header
    .split(',')
    .map((value) => value.trim())
    .some((value) => value === '*' || value === etag);
}

export const GET: RequestHandler = async ({ params, request }) => {
  if (!privateConfig.tileProxyEnabled) throw error(404, 'Tile proxy is disabled');
  const coordinates = parseTileCoordinates(params, privateConfig.tileMaxZoom);
  if (!coordinates) throw error(400, 'Invalid tile coordinates');

  try {
    const tile = await tileCache.get(
      coordinates,
      originOnlyReferer(request.headers.get('referer'), privateConfig.origin)
    );
    const headers = new Headers({
      'cache-control':
        tile.cacheStatus === 'stale'
          ? 'private, no-cache'
          : `private, max-age=${tile.maxAgeSeconds}`,
      'content-type': tile.contentType,
      'x-content-type-options': 'nosniff',
      'x-mapme-tile-cache': tile.cacheStatus
    });
    if (tile.etag) headers.set('etag', tile.etag);
    if (tile.lastModified) headers.set('last-modified', tile.lastModified);
    if (etagMatches(request.headers.get('if-none-match'), tile.etag)) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(Uint8Array.from(tile.bytes).buffer, { headers });
  } catch {
    return Response.json(
      { error: 'The tile provider is temporarily unavailable' },
      { status: 502, headers: { 'cache-control': 'no-store' } }
    );
  }
};
