import { self } from '$app/service-worker';
import { version } from '$app/env';
import { assets as staticAssets, immutable } from '$app/manifest';

const cacheName = `mapme-assets-${version}`;
// Manifest paths are relative to the base path, which is where this worker is served from.
const assets = [...immutable, ...staticAssets].map(
  ({ path }) => new URL(path, self.location.href).pathname
);
const assetPaths = new Set(assets);

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([caches.open(cacheName).then((cache) => cache.addAll(assets)), self.skipWaiting()])
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

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => cached ?? fetch(request))
  );
});
