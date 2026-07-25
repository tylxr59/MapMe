import { createHash } from 'node:crypto';
import { getDatabase } from '$lib/server/db/driver';
import { privateConfig } from '$lib/server/config/private';
import type { GeocodingResult } from './provider';

function endpointFingerprint(): string {
  return createHash('sha256').update(privateConfig.geocodingUrl).digest('hex').slice(0, 16);
}

function key(kind: 'forward' | 'reverse', normalizedQuery: string): string {
  return createHash('sha256')
    .update(
      `${privateConfig.geocodingProvider}\0${endpointFingerprint()}\0${kind}\0${normalizedQuery}`
    )
    .digest('hex');
}

export function getCachedGeocoding(
  kind: 'forward' | 'reverse',
  normalizedQuery: string
): GeocodingResult[] | null {
  const database = getDatabase();
  database
    .prepare('DELETE FROM geocoding_cache WHERE expires_at <= ?')
    .run(new Date().toISOString());
  const row = database
    .prepare(
      `SELECT response_json
       FROM geocoding_cache
       WHERE cache_key = ? AND expires_at > ?`
    )
    .get(key(kind, normalizedQuery), new Date().toISOString()) as
    { response_json: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.response_json) as GeocodingResult[];
  } catch {
    return null;
  }
}

export function cacheGeocoding(
  kind: 'forward' | 'reverse',
  normalizedQuery: string,
  request: Record<string, unknown>,
  results: GeocodingResult[]
): void {
  if (results.length === 0) return;
  const now = new Date();
  const expires = new Date(now.getTime() + privateConfig.geocodingCacheTtlDays * 86_400_000);
  getDatabase()
    .prepare(
      `INSERT OR REPLACE INTO geocoding_cache (
         cache_key, provider, endpoint_fingerprint, request_kind, normalized_query,
         request_json, response_json, result_count, created_at, expires_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      key(kind, normalizedQuery),
      privateConfig.geocodingProvider,
      endpointFingerprint(),
      kind,
      normalizedQuery,
      JSON.stringify(request),
      JSON.stringify(results),
      results.length,
      now.toISOString(),
      expires.toISOString()
    );
}
