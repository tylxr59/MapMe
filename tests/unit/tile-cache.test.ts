import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { originOnlyReferer, parseTileCoordinates, TileCache } from '$lib/server/tiles/cache';

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'mapme-tiles-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
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

    const firstCache = new TileCache(options);
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

    const secondCache = new TileCache({ ...options, fetcher: vi.fn<typeof fetch>() });
    const persisted = await secondCache.get({ z: 2, x: 1, y: 2 }, 'http://mapme.test/');
    expect(persisted.cacheStatus).toBe('hit');
    expect([...persisted.bytes]).toEqual([1, 2, 3]);
    expect(JSON.parse(await readFile(join(directory, '2/1/2.json'), 'utf8')).etag).toBe('"tile-1"');
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
    const cache = new TileCache({
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
    const cache = new TileCache({
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
