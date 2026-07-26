<script lang="ts">
  import { onMount } from 'svelte';
  import type { MapPlace } from '$lib/types';

  let {
    places,
    selectedId = null,
    draft = null,
    tileUrl,
    tileAttribution,
    tileMaxZoom,
    tileProxyEnabled,
    onselect,
    onmapclick,
    onviewportchange
  }: {
    places: MapPlace[];
    selectedId?: string | null;
    draft?: { latitude: number; longitude: number } | null;
    tileUrl: string;
    tileAttribution: string;
    tileMaxZoom: number;
    tileProxyEnabled: boolean;
    onselect: (id: string) => void;
    onmapclick: (coordinates: { latitude: number; longitude: number }) => void;
    onviewportchange?: (coordinates: { latitude: number; longitude: number }) => void;
  } = $props();

  let container: HTMLDivElement;
  let map: import('leaflet').Map | null = null;
  let cluster: import('leaflet').MarkerClusterGroup | null = null;
  let draftMarker: import('leaflet').Marker | null = null;
  let leaflet: typeof import('leaflet') | null = null;
  let initialTileState = $state<'loading' | 'slow' | 'ready'>('loading');
  const placeFocusZoom = 15;

  function saveViewport() {
    if (!map) return;
    const point = map.getCenter();
    localStorage.setItem(
      'mapme.viewport',
      JSON.stringify({ center: [point.lat, point.lng], zoom: map.getZoom() })
    );
    onviewportchange?.({ latitude: point.lat, longitude: point.lng });
  }

  function centerOnCurrentLocation() {
    if (!map || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!map) return;
        map.setView([coords.latitude, coords.longitude], 13);
        saveViewport();
      },
      () => {
        // Keep the default view when location access is denied or unavailable.
      },
      {
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 300_000
      }
    );
  }

  function markerHtml(place: MapPlace): string {
    return `<div class="mapme-marker" style="background:${place.category.color}">${place.category.iconSvg}</div>`;
  }

  function refreshMarkers() {
    if (!leaflet || !map || !cluster) return;
    cluster.clearLayers();
    for (const place of places) {
      const marker = leaflet.marker([place.latitude, place.longitude], {
        icon: leaflet.divIcon({
          html: markerHtml(place),
          className: '',
          iconSize: [34, 34],
          iconAnchor: [17, 34],
          popupAnchor: [0, -34]
        }),
        title: place.name
      });
      marker.bindTooltip(place.name, { direction: 'top', offset: [0, -28] });
      marker.on('click', () => onselect(place.id));
      cluster.addLayer(marker);
      if (place.id === selectedId) {
        queueMicrotask(() =>
          map?.setView([place.latitude, place.longitude], Math.min(placeFocusZoom, tileMaxZoom), {
            animate: true
          })
        );
      }
    }
  }

  function refreshDraft() {
    if (!leaflet || !map) return;
    if (!draft) {
      if (draftMarker) {
        draftMarker.remove();
        draftMarker = null;
      }
      return;
    }
    if (!draftMarker) {
      draftMarker = leaflet
        .marker([draft.latitude, draft.longitude], {
          draggable: true,
          zIndexOffset: 1000,
          icon: leaflet.divIcon({
            html: '<div class="mapme-marker mapme-draft-marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg></div>',
            className: '',
            iconSize: [34, 34],
            iconAnchor: [17, 34]
          })
        })
        .addTo(map);
      draftMarker.on('dragend', () => {
        const point = draftMarker!.getLatLng();
        onmapclick({ latitude: point.lat, longitude: point.lng });
      });
    } else {
      draftMarker.setLatLng([draft.latitude, draft.longitude]);
    }
    map.panTo([draft.latitude, draft.longitude]);
  }

  $effect(() => {
    void places;
    void selectedId;
    refreshMarkers();
  });

  $effect(() => {
    void draft;
    refreshDraft();
  });

  onMount(() => {
    let destroyed = false;
    let resizeObserver: ResizeObserver | undefined;
    let slowTileTimer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      const leafletModule = await import('leaflet');
      leaflet = leafletModule.default;
      await import('leaflet.markercluster');
      if (destroyed) return;
      const saved = localStorage.getItem('mapme.viewport');
      let center: [number, number] = [39.5, -98.35];
      let zoom = 4;
      if (saved) {
        try {
          const value = JSON.parse(saved);
          if (Array.isArray(value.center) && Number.isFinite(value.zoom)) {
            center = value.center;
            zoom = value.zoom;
          }
        } catch {
          // Ignore an invalid local preference.
        }
      }
      map = leaflet.map(container, { zoomControl: false }).setView(center, zoom);
      let initialTileLoaded = false;
      const tileLayer = leaflet.tileLayer(tileUrl, {
        attribution: tileAttribution,
        maxZoom: tileMaxZoom,
        referrerPolicy: 'origin'
      });
      tileLayer.on('tileload', () => {
        initialTileLoaded = true;
      });
      tileLayer.on('tileerror', () => {
        if (initialTileState !== 'ready') initialTileState = 'slow';
      });
      tileLayer.on('load', () => {
        if (!initialTileLoaded) {
          initialTileState = 'slow';
          return;
        }
        initialTileState = 'ready';
        clearTimeout(slowTileTimer);
      });
      slowTileTimer = setTimeout(() => {
        if (initialTileState !== 'ready') initialTileState = 'slow';
      }, 8_000);
      tileLayer.addTo(map);
      leaflet.control.zoom({ position: 'topright' }).addTo(map);
      cluster = leaflet.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 48 });
      map.addLayer(cluster);
      map.on('click', (event) =>
        onmapclick({ latitude: event.latlng.lat, longitude: event.latlng.lng })
      );
      map.on('moveend', saveViewport);
      onviewportchange?.({ latitude: center[0], longitude: center[1] });
      if (!saved) centerOnCurrentLocation();
      refreshMarkers();
      refreshDraft();
      resizeObserver = new ResizeObserver(() => map?.invalidateSize({ pan: false }));
      resizeObserver.observe(container);
      setTimeout(() => map?.invalidateSize(), 0);
    })();
    return () => {
      destroyed = true;
      clearTimeout(slowTileTimer);
      resizeObserver?.disconnect();
      map?.remove();
      map = null;
    };
  });
</script>

<div class="map-shell">
  <div class="map" bind:this={container} aria-label="Saved places map"></div>
  {#if initialTileState !== 'ready'}
    <div
      class="tile-status"
      class:slow={initialTileState === 'slow'}
      role="status"
      aria-live="polite"
      data-testid="tile-status"
    >
      <span class="tile-spinner" aria-hidden="true"></span>
      <span>
        <strong>
          {initialTileState === 'slow'
            ? 'Map tiles are taking longer than expected'
            : tileProxyEnabled
              ? 'Starting map tile service…'
              : 'Loading map tiles…'}
        </strong>
        {#if initialTileState === 'slow'}
          <small>MapMe will keep trying.</small>
        {:else if tileProxyEnabled}
          <small>The first load can take a moment while the tile proxy starts.</small>
        {/if}
      </span>
    </div>
  {/if}
</div>

<style>
  .map-shell {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 20rem;
  }

  .map {
    width: 100%;
    height: 100%;
    min-height: 20rem;
  }

  .tile-status {
    position: absolute;
    z-index: 1000;
    top: 1rem;
    left: 50%;
    display: flex;
    max-width: min(28rem, calc(100% - 2rem));
    align-items: center;
    gap: 0.75rem;
    padding: 0.7rem 0.9rem;
    border: 1px solid color-mix(in srgb, var(--line) 80%, transparent);
    border-radius: 0.75rem;
    background: color-mix(in srgb, var(--surface-raised) 94%, transparent);
    box-shadow: 0 0.4rem 1.25rem rgb(15 23 42 / 18%);
    color: var(--text);
    pointer-events: none;
    transform: translateX(-50%);
    backdrop-filter: blur(0.4rem);
  }

  .tile-status.slow {
    border-color: color-mix(in srgb, var(--danger) 50%, var(--line));
  }

  .tile-status span:last-child {
    display: grid;
    gap: 0.1rem;
  }

  .tile-status strong {
    font-size: 0.85rem;
    line-height: 1.25;
  }

  .tile-status small {
    color: var(--text-secondary);
    font-size: 0.75rem;
    line-height: 1.3;
  }

  .tile-spinner {
    width: 1rem;
    height: 1rem;
    flex: 0 0 auto;
    border: 2px solid color-mix(in srgb, var(--green-700) 25%, transparent);
    border-top-color: var(--green-700);
    border-radius: 50%;
    animation: tile-spin 0.8s linear infinite;
  }

  @keyframes tile-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tile-spinner {
      animation: none;
      border-color: var(--green-700);
    }
  }
</style>
