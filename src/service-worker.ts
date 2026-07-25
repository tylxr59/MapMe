/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;
const cacheName = `mapme-assets-${version}`;
const assets = [...build, ...files];
const assetPaths = new Set(assets.map((asset) => new URL(asset, worker.location.origin).pathname));

worker.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(cacheName).then((cache) => cache.addAll(assets)),
      worker.skipWaiting()
    ])
  );
});

worker.addEventListener('activate', (event) => {
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
      .then(() => worker.clients.claim())
  );
});

worker.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== worker.location.origin || !assetPaths.has(url.pathname)) return;

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => cached ?? fetch(request))
  );
});
