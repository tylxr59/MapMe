import { self } from '$app/service-worker';
import { version } from '$app/env';
import { assets as staticAssets, immutable } from '$app/manifest';

const cacheName = `mapme-assets-${version}`;
// Manifest paths are relative to the base path, which is where this worker is served from.
const assetPaths = new Set(
  [...immutable, ...staticAssets].map(({ path }) => new URL(path, self.location.href).pathname)
);

self.addEventListener('install', (event) => {
  event.waitUntil(
    // Cache assets as they are used instead of downloading every route and font
    // while the first map is trying to load.
    self.skipWaiting()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('mapme-assets-') && key !== cacheName)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !assetPaths.has(url.pathname)) return;

  let store: Promise<void> = Promise.resolve();
  const response = caches.open(cacheName).then(async (cache) => {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const result = await fetch(request);
    if (result.ok) store = cache.put(request, result.clone());
    return result;
  });
  event.respondWith(response);
  event.waitUntil(response.then(() => store).catch(() => undefined));
});
