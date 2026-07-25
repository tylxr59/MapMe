import packageJson from '../../../../package.json';
import { privateConfig } from '$lib/server/config/private';
import { cacheGeocoding, getCachedGeocoding } from './cache';
import type { GeocodingProvider, GeocodingResult } from './provider';

let requestQueue = Promise.resolve();
let lastRequestAt = 0;

async function rateLimitedFetch(url: URL): Promise<unknown> {
  let resolveQueue: () => void = () => undefined;
  const previous = requestQueue;
  requestQueue = new Promise<void>((resolve) => {
    resolveQueue = resolve;
  });
  await previous;
  try {
    const wait = Math.max(0, 1000 - (Date.now() - lastRequestAt));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          'user-agent': `MapMe/${packageJson.version} (+https://github.com/tylxr59/MapMe)`
        }
      });
      lastRequestAt = Date.now();
      if (!response.ok) throw new Error(`Geocoding provider returned ${response.status}`);
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > 1_000_000) throw new Error('Geocoding response was too large');
      const text = await response.text();
      if (text.length > 1_000_000) throw new Error('Geocoding response was too large');
      return JSON.parse(text);
    } finally {
      clearTimeout(timeout);
    }
  } finally {
    resolveQueue();
  }
}

function normalizeResults(value: unknown): GeocodingResult[] {
  const rows = Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : [];
  return rows
    .slice(0, 8)
    .map((row: any) => ({
      displayName: String(row.display_name ?? '').slice(0, 500),
      latitude: Number(row.lat),
      longitude: Number(row.lon),
      type: row.type ? String(row.type).slice(0, 100) : null
    }))
    .filter(
      (row) =>
        row.displayName &&
        Number.isFinite(row.latitude) &&
        row.latitude >= -90 &&
        row.latitude <= 90 &&
        Number.isFinite(row.longitude) &&
        row.longitude >= -180 &&
        row.longitude <= 180
    );
}

export const nominatimProvider: GeocodingProvider = {
  async forward(query) {
    const normalized = query.normalize('NFKC').trim().toLowerCase();
    const cached = getCachedGeocoding('forward', normalized);
    if (cached) return cached;
    const url = new URL(`${privateConfig.geocodingUrl}/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '8');
    url.searchParams.set('addressdetails', '1');
    if (privateConfig.geocodingApiKey)
      url.searchParams.set('api_key', privateConfig.geocodingApiKey);
    const results = normalizeResults(await rateLimitedFetch(url));
    cacheGeocoding('forward', normalized, { query }, results);
    return results;
  },
  async reverse(latitude, longitude) {
    const normalized = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
    const cached = getCachedGeocoding('reverse', normalized);
    if (cached) return cached;
    const url = new URL(`${privateConfig.geocodingUrl}/reverse`);
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    url.searchParams.set('format', 'jsonv2');
    if (privateConfig.geocodingApiKey)
      url.searchParams.set('api_key', privateConfig.geocodingApiKey);
    const results = normalizeResults(await rateLimitedFetch(url));
    cacheGeocoding('reverse', normalized, { latitude, longitude }, results);
    return results;
  }
};
