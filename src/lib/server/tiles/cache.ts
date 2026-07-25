import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const fallbackCacheLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const maximumTileBytes = 5 * 1024 * 1024;

export interface TileCoordinates {
  z: number;
  x: number;
  y: number;
}

interface TileMetadata {
  version: 1;
  contentType: string;
  etag: string | null;
  lastModified: string | null;
  fetchedAt: number;
  expiresAt: number;
  cacheLifetimeMs: number;
  size: number;
}

interface CacheEntry {
  tilePath: string;
  metadataPath: string;
  metadata: TileMetadata;
  lastAccessedAt: number;
}

export interface TileResult {
  bytes: Uint8Array;
  contentType: string;
  etag: string | null;
  lastModified: string | null;
  maxAgeSeconds: number;
  cacheStatus: 'hit' | 'miss' | 'revalidated' | 'stale';
}

interface TileCacheOptions {
  directory: string;
  maximumBytes: number;
  upstreamTemplate: string;
  userAgent: string;
  fetcher?: typeof fetch;
  now?: () => number;
}

function isTileMetadata(value: unknown): value is TileMetadata {
  if (!value || typeof value !== 'object') return false;
  const metadata = value as Record<string, unknown>;
  return (
    metadata.version === 1 &&
    typeof metadata.contentType === 'string' &&
    (typeof metadata.etag === 'string' || metadata.etag === null) &&
    (typeof metadata.lastModified === 'string' || metadata.lastModified === null) &&
    typeof metadata.fetchedAt === 'number' &&
    typeof metadata.expiresAt === 'number' &&
    typeof metadata.cacheLifetimeMs === 'number' &&
    typeof metadata.size === 'number'
  );
}

function cachePolicy(
  response: Response,
  fallback: number | null
): { lifetimeMs: number; storable: boolean } {
  const cacheControl = response.headers.get('cache-control') ?? '';
  if (/(?:^|,)\s*no-store\b/i.test(cacheControl)) return { lifetimeMs: 0, storable: false };
  if (/(?:^|,)\s*no-cache\b/i.test(cacheControl)) return { lifetimeMs: 0, storable: true };
  const maxAge = cacheControl.match(/(?:^|,)\s*(?:s-maxage|max-age)=(?:"?)(\d+)/i);
  if (maxAge) return { lifetimeMs: Number(maxAge[1]) * 1000, storable: true };

  const expires = response.headers.get('expires');
  if (expires) {
    const expiresAt = Date.parse(expires);
    const date = Date.parse(response.headers.get('date') ?? '');
    if (Number.isFinite(expiresAt)) {
      return {
        lifetimeMs: Math.max(0, expiresAt - (Number.isFinite(date) ? date : Date.now())),
        storable: true
      };
    }
  }
  return { lifetimeMs: fallback ?? fallbackCacheLifetimeMs, storable: true };
}

async function atomicWrite(path: string, contents: Uint8Array | string): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, contents, { mode: 0o600 });
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

async function metadataFiles(directory: string): Promise<string[]> {
  const results: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) results.push(...(await metadataFiles(path)));
    else if (entry.isFile() && entry.name.endsWith('.json')) results.push(path);
    else if (entry.isFile() && entry.name.endsWith('.tmp')) {
      await rm(path, { force: true }).catch(() => undefined);
    }
  }
  return results;
}

export function parseTileCoordinates(
  values: { z?: string; x?: string; y?: string },
  maximumZoom: number
): TileCoordinates | null {
  if (![values.z, values.x, values.y].every((value) => /^\d+$/.test(value ?? ''))) return null;
  const z = Number(values.z);
  const x = Number(values.x);
  const y = Number(values.y);
  if (!Number.isSafeInteger(z) || z < 0 || z > maximumZoom) return null;
  const dimension = 2 ** z;
  if (
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= dimension ||
    y >= dimension
  ) {
    return null;
  }
  return { z, x, y };
}

export function originOnlyReferer(candidate: string | null, configuredOrigin: string): string {
  const configured = new URL(configuredOrigin);
  if (candidate) {
    try {
      const incoming = new URL(candidate);
      if (incoming.origin === configured.origin) return `${incoming.origin}/`;
    } catch {
      // Fall back to the configured public origin.
    }
  }
  return `${configured.origin}/`;
}

export class TileCache {
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  private readonly entries = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<TileResult>>();
  private initialized: Promise<void> | null = null;
  private totalBytes = 0;

  constructor(private readonly options: TileCacheOptions) {
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? Date.now;
  }

  private key({ z, x, y }: TileCoordinates): string {
    return `${z}/${x}/${y}`;
  }

  private paths(coordinates: TileCoordinates) {
    const base = join(
      this.options.directory,
      String(coordinates.z),
      String(coordinates.x),
      String(coordinates.y)
    );
    return { tilePath: `${base}.tile`, metadataPath: `${base}.json` };
  }

  private async initialize(): Promise<void> {
    await mkdir(this.options.directory, { recursive: true, mode: 0o700 });
    for (const metadataPath of await metadataFiles(this.options.directory)) {
      const tilePath = metadataPath.replace(/\.json$/, '.tile');
      try {
        const metadata = JSON.parse(await readFile(metadataPath, 'utf8')) as unknown;
        const tileInfo = await stat(tilePath);
        if (!isTileMetadata(metadata) || tileInfo.size !== metadata.size) throw new Error();
        const key = metadataPath
          .slice(this.options.directory.length + 1, -'.json'.length)
          .split('\\')
          .join('/');
        this.entries.set(key, {
          tilePath,
          metadataPath,
          metadata,
          lastAccessedAt: tileInfo.mtimeMs
        });
        this.totalBytes += metadata.size;
      } catch {
        await Promise.all([
          rm(tilePath, { force: true }).catch(() => undefined),
          rm(metadataPath, { force: true }).catch(() => undefined)
        ]);
      }
    }
    await this.enforceLimit();
  }

  private async ready(): Promise<void> {
    this.initialized ??= this.initialize();
    await this.initialized;
  }

  private result(
    bytes: Uint8Array,
    metadata: TileMetadata,
    cacheStatus: TileResult['cacheStatus']
  ): TileResult {
    return {
      bytes,
      contentType: metadata.contentType,
      etag: metadata.etag,
      lastModified: metadata.lastModified,
      maxAgeSeconds: Math.max(0, Math.floor((metadata.expiresAt - this.now()) / 1000)),
      cacheStatus
    };
  }

  private async remove(key: string, entry: CacheEntry): Promise<void> {
    this.entries.delete(key);
    this.totalBytes = Math.max(0, this.totalBytes - entry.metadata.size);
    await Promise.all([
      rm(entry.tilePath, { force: true }).catch(() => undefined),
      rm(entry.metadataPath, { force: true }).catch(() => undefined)
    ]);
  }

  private async read(key: string, entry: CacheEntry): Promise<Uint8Array | null> {
    try {
      const bytes = await readFile(entry.tilePath);
      if (bytes.byteLength !== entry.metadata.size) throw new Error();
      entry.lastAccessedAt = this.now();
      return bytes;
    } catch {
      await this.remove(key, entry);
      return null;
    }
  }

  private upstreamUrl({ z, x, y }: TileCoordinates): string {
    return this.options.upstreamTemplate
      .replaceAll('{z}', String(z))
      .replaceAll('{x}', String(x))
      .replaceAll('{y}', String(y));
  }

  private async request(
    coordinates: TileCoordinates,
    referer: string,
    existing: CacheEntry | null
  ): Promise<TileResult> {
    const key = this.key(coordinates);
    const headers = new Headers({
      accept: 'image/avif,image/webp,image/png,image/*;q=0.8,*/*;q=0.5',
      referer,
      'user-agent': this.options.userAgent
    });
    if (existing?.metadata.etag) headers.set('if-none-match', existing.metadata.etag);
    if (existing?.metadata.lastModified)
      headers.set('if-modified-since', existing.metadata.lastModified);

    let response: Response;
    try {
      response = await this.fetcher(this.upstreamUrl(coordinates), {
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(10_000)
      });
    } catch (error) {
      if (existing) {
        const bytes = await this.read(key, existing);
        if (bytes) return this.result(bytes, existing.metadata, 'stale');
      }
      throw error;
    }

    if (response.status === 304 && existing) {
      const bytes = await this.read(key, existing);
      if (bytes) {
        const policy = cachePolicy(response, existing.metadata.cacheLifetimeMs);
        existing.metadata = {
          ...existing.metadata,
          etag: response.headers.get('etag') ?? existing.metadata.etag,
          lastModified: response.headers.get('last-modified') ?? existing.metadata.lastModified,
          fetchedAt: this.now(),
          expiresAt: this.now() + policy.lifetimeMs,
          cacheLifetimeMs: policy.lifetimeMs
        };
        if (policy.storable)
          await atomicWrite(existing.metadataPath, JSON.stringify(existing.metadata));
        else await this.remove(key, existing);
        return this.result(bytes, existing.metadata, 'revalidated');
      }
    }

    if (!response.ok) {
      if (existing) {
        const bytes = await this.read(key, existing);
        if (bytes) return this.result(bytes, existing.metadata, 'stale');
      }
      throw new Error(`Tile provider returned ${response.status}`);
    }

    const contentType = (response.headers.get('content-type') ?? '').split(';', 1)[0].trim();
    if (!contentType.startsWith('image/')) throw new Error('Tile provider returned a non-image');
    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (declaredLength > maximumTileBytes) throw new Error('Tile provider response was too large');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maximumTileBytes)
      throw new Error('Tile provider response was too large');

    const policy = cachePolicy(response, null);
    const metadata: TileMetadata = {
      version: 1,
      contentType,
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
      fetchedAt: this.now(),
      expiresAt: this.now() + policy.lifetimeMs,
      cacheLifetimeMs: policy.lifetimeMs,
      size: bytes.byteLength
    };
    if (!policy.storable) {
      if (existing) await this.remove(key, existing);
      return this.result(bytes, metadata, 'miss');
    }
    const paths = this.paths(coordinates);
    await atomicWrite(paths.tilePath, bytes);
    await atomicWrite(paths.metadataPath, JSON.stringify(metadata));

    if (existing) this.totalBytes -= existing.metadata.size;
    const entry = {
      ...paths,
      metadata,
      lastAccessedAt: this.now()
    };
    this.entries.set(key, entry);
    this.totalBytes += metadata.size;
    await this.enforceLimit();
    return this.result(bytes, metadata, 'miss');
  }

  private async enforceLimit(): Promise<void> {
    if (this.totalBytes <= this.options.maximumBytes) return;
    const oldestFirst = [...this.entries.entries()].sort(
      ([, first], [, second]) => first.lastAccessedAt - second.lastAccessedAt
    );
    for (const [key, entry] of oldestFirst) {
      if (this.totalBytes <= this.options.maximumBytes) break;
      this.entries.delete(key);
      this.totalBytes = Math.max(0, this.totalBytes - entry.metadata.size);
      await Promise.all([
        rm(entry.tilePath, { force: true }).catch(() => undefined),
        rm(entry.metadataPath, { force: true }).catch(() => undefined)
      ]);
    }
  }

  async get(coordinates: TileCoordinates, referer: string): Promise<TileResult> {
    await this.ready();
    const key = this.key(coordinates);
    const existingRequest = this.inFlight.get(key);
    if (existingRequest) return existingRequest;

    const operation = (async () => {
      let entry = this.entries.get(key) ?? null;
      if (entry) {
        const bytes = await this.read(key, entry);
        if (!bytes) entry = null;
        else if (entry.metadata.expiresAt > this.now()) {
          return this.result(bytes, entry.metadata, 'hit');
        }
      }
      return this.request(coordinates, referer, entry);
    })();
    this.inFlight.set(key, operation);
    try {
      return await operation;
    } finally {
      this.inFlight.delete(key);
    }
  }
}
