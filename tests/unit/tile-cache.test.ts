import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { originOnlyReferer, parseTileCoordinates, TileCache } from '#lib/server/tiles/cache.js';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, readdir: vi.fn(actual.readdir) };
});

const temporaryDirectories: string[] = [];
const activeCaches: TileCache[] = [];

function createCache(options: ConstructorParameters<typeof TileCache>[0]): TileCache {
  const cache = new TileCache(options);
  activeCaches.push(cache);
  return cache;
}

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'mapme-tiles-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(activeCaches.splice(0).map((cache) => cache.initialize()));
  vi.mocked(readdir).mockClear();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe('tile proxy validation', () => {
  it('accepts only coordinates inside the requested zoom grid', () => {
    expect(parseTileCoordinates({ z: '4', x: '7', y: '15' }, 19)).toEqual({
      z: 4,
      x: 7,
      y: 15
    });
    expect(parseTileCoordinates({ z: '4', x: '16', y: '0' }, 19)).toBeNull();
    expect(parseTileCoordinates({ z: '../4', x: '1', y: '1' }, 19)).toBeNull();
    expect(parseTileCoordinates({ z: '20', x: '1', y: '1' }, 19)).toBeNull();
  });

  it('forwards only a same-origin origin and ignores spoofed referrers', () => {
    expect(
      originOnlyReferer('http://mapme.test:3000/place?secret=yes', 'http://mapme.test:3000')
    ).toBe('http://mapme.test:3000/');
    expect(originOnlyReferer('https://attacker.test/path', 'http://mapme.test:3000')).toBe(
      'http://mapme.test:3000/'
    );
  });
});

describe('persistent tile cache', () => {
  it('identifies MapMe upstream and serves repeat requests from disk', async () => {
    const directory = await temporaryDirectory();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(Uint8Array.from([1, 2, 3]), {
        headers: {
          'cache-control': 'public, max-age=3600',
          'content-type': 'image/png',
          etag: '"tile-1"'
        }
      })
    );
    const options = {
      directory,
      maximumBytes: 64 * 1024 * 1024,
      upstreamTemplate: 'https://tiles.test/{z}/{x}/{y}.png',
      userAgent: 'MapMe/test',
      fetcher
    };

    const firstCache = createCache(options);
    expect((await firstCache.get({ z: 2, x: 1, y: 2 }, 'http://mapme.test/')).cacheStatus).toBe(
      'miss'
    );
    expect((await firstCache.get({ z: 2, x: 1, y: 2 }, 'http://mapme.test/')).cacheStatus).toBe(
      'hit'
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('https://tiles.test/2/1/2.png');
    const headers = fetcher.mock.calls[0][1]?.headers as Headers;
    expect(headers.get('user-agent')).toBe('MapMe/test');
    expect(headers.get('referer')).toBe('http://mapme.test/');

    const secondCache = createCache({ ...options, fetcher: vi.fn<typeof fetch>() });
    const persisted = await secondCache.get({ z: 2, x: 1, y: 2 }, 'http://mapme.test/');
    expect(persisted.cacheStatus).toBe('hit');
    expect([...persisted.bytes]).toEqual([1, 2, 3]);
    expect(JSON.parse(await readFile(join(directory, '2/1/2.json'), 'utf8')).etag).toBe('"tile-1"');
  });

  it('serves cached and uncached tiles while the startup directory scan is blocked', async () => {
    const directory = await temporaryDirectory();
    const options = {
      directory,
      maximumBytes: 64 * 1024 * 1024,
      upstreamTemplate: 'https://tiles.test/{z}/{x}/{y}.png',
      userAgent: 'MapMe/test',
      fetcher: vi.fn<typeof fetch>().mockImplementation(
        async () =>
          new Response(Uint8Array.from([1, 2, 3]), {
            headers: { 'cache-control': 'max-age=3600', 'content-type': 'image/png' }
          })
      )
    };
    const previousCache = createCache(options);
    await previousCache.get({ z: 2, x: 1, y: 2 }, 'http://mapme.test/');
    await previousCache.initialize();
    options.fetcher.mockClear();

    const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
    let releaseScan!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseScan = resolve;
    });
    vi.mocked(readdir).mockImplementationOnce(async (...args) => {
      await gate;
      return actual.readdir(...args);
    });
    const cache = createCache(options);
    let completed = false;
    const requests = Promise.all([
      cache.get({ z: 2, x: 1, y: 2 }, 'http://mapme.test/'),
      cache.get({ z: 2, x: 2, y: 2 }, 'http://mapme.test/')
    ]).then((results) => {
      completed = true;
      return results;
    });
    try {
      await vi.waitFor(() => expect(completed).toBe(true));
      expect((await requests).map((result) => result.cacheStatus)).toEqual(['hit', 'miss']);
      expect(options.fetcher).toHaveBeenCalledTimes(1);
    } finally {
      releaseScan();
      await cache.initialize();
      await requests;
    }
    // The background index must not count newly fetched tiles twice or delete them.
    expect((await cache.get({ z: 2, x: 2, y: 2 }, 'http://mapme.test/')).cacheStatus).toBe('hit');
  });

  it('shares concurrent requests for the same tile', async () => {
    const directory = await temporaryDirectory();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(Uint8Array.from([1, 2, 3]), {
          headers: { 'cache-control': 'max-age=3600', 'content-type': 'image/png' }
        })
    );
    const cache = createCache({
      directory,
      maximumBytes: 1024,
      upstreamTemplate: 'https://tiles.test/{z}/{x}/{y}.png',
      userAgent: 'MapMe/test',
      fetcher
    });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => cache.get({ z: 2, x: 1, y: 2 }, 'http://mapme.test/'))
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(results.every((result) => result.cacheStatus === 'miss')).toBe(true);
  });

  it('conditionally revalidates expired tiles and serves stale data on an outage', async () => {
    const directory = await temporaryDirectory();
    let upstreamCalls = 0;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      upstreamCalls += 1;
      if (upstreamCalls === 1) {
        return new Response(Uint8Array.from([4, 5, 6]), {
          headers: {
            'cache-control': 'public, max-age=0',
            'content-type': 'image/png',
            etag: '"tile-2"'
          }
        });
      }
      const headers = init?.headers as Headers;
      expect(headers.get('if-none-match')).toBe('"tile-2"');
      if (upstreamCalls === 2) {
        return new Response(null, {
          status: 304,
          headers: { 'cache-control': 'public, max-age=0' }
        });
      }
      throw new Error('offline');
    });
    const cache = createCache({
      directory,
      maximumBytes: 64 * 1024 * 1024,
      upstreamTemplate: 'https://tiles.test/{z}/{x}/{y}.png',
      userAgent: 'MapMe/test',
      fetcher
    });

    await cache.get({ z: 1, x: 1, y: 0 }, 'http://mapme.test/');
    expect((await cache.get({ z: 1, x: 1, y: 0 }, 'http://mapme.test/')).cacheStatus).toBe(
      'revalidated'
    );
    const stale = await cache.get({ z: 1, x: 1, y: 0 }, 'http://mapme.test/');
    expect(stale.cacheStatus).toBe('stale');
    expect([...stale.bytes]).toEqual([4, 5, 6]);
  });

  it('enforces the disk limit after indexing and after concurrent writes', async () => {
    const directory = await temporaryDirectory();
    const options = {
      directory,
      maximumBytes: 100,
      upstreamTemplate: 'https://tiles.test/{z}/{x}/{y}.png',
      userAgent: 'MapMe/test',
      fetcher: vi.fn<typeof fetch>().mockImplementation(
        async () =>
          new Response(Uint8Array.from([1, 2, 3]), {
            headers: { 'cache-control': 'max-age=3600', 'content-type': 'image/png' }
          })
      )
    };
    const previousCache = createCache(options);
    await previousCache.get({ z: 2, x: 0, y: 0 }, 'http://mapme.test/');
    await previousCache.get({ z: 2, x: 1, y: 0 }, 'http://mapme.test/');
    await previousCache.initialize();
    const cache = createCache({ ...options, maximumBytes: 3 });
    await cache.initialize();
    const tileBytes = async () => {
      const files = await readdir(directory, { recursive: true });
      const tiles = files.filter((path) => path.endsWith('.tile'));
      return (await Promise.all(tiles.map((path) => readFile(join(directory, path))))).reduce(
        (total, bytes) => total + bytes.byteLength,
        0
      );
    };
    expect(await tileBytes()).toBe(3);
    await Promise.all([
      cache.get({ z: 2, x: 2, y: 0 }, 'http://mapme.test/'),
      cache.get({ z: 2, x: 3, y: 0 }, 'http://mapme.test/')
    ]);
    expect(await tileBytes()).toBe(3);
    // An evicted key can be fetched again without double-counting its old size.
    await cache.get({ z: 2, x: 0, y: 0 }, 'http://mapme.test/');
    expect(await tileBytes()).toBe(3);
  });

  it('does not persist responses marked no-store', async () => {
    const directory = await temporaryDirectory();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(Uint8Array.from([7, 8, 9]), {
          headers: {
            'cache-control': 'no-store',
            'content-type': 'image/png'
          }
        })
    );
    const cache = createCache({
      directory,
      maximumBytes: 64 * 1024 * 1024,
      upstreamTemplate: 'https://tiles.test/{z}/{x}/{y}.png',
      userAgent: 'MapMe/test',
      fetcher
    });

    await cache.get({ z: 1, x: 0, y: 0 }, 'http://mapme.test/');
    await cache.get({ z: 1, x: 0, y: 0 }, 'http://mapme.test/');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
