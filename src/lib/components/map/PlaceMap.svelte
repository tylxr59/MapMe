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
    onselect: (id: string) => void;
    onmapclick: (coordinates: { latitude: number; longitude: number }) => void;
    onviewportchange?: (coordinates: { latitude: number; longitude: number }) => void;
  } = $props();

  let container: HTMLDivElement;
  let map: import('leaflet').Map | null = null;
  let cluster: import('leaflet').MarkerClusterGroup | null = null;
  let draftMarker: import('leaflet').Marker | null = null;
  let leaflet: typeof import('leaflet') | null = null;

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
        queueMicrotask(() => map?.panTo([place.latitude, place.longitude]));
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
      leaflet
        .tileLayer(tileUrl, {
          attribution: tileAttribution,
          maxZoom: tileMaxZoom
        })
        .addTo(map);
      leaflet.control.zoom({ position: 'bottomright' }).addTo(map);
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
      setTimeout(() => map?.invalidateSize(), 0);
    })();
    return () => {
      destroyed = true;
      map?.remove();
      map = null;
    };
  });
</script>

<div class="map" bind:this={container} aria-label="Saved places map"></div>

<style>
  .map {
    width: 100%;
    height: 100%;
    min-height: 20rem;
  }
</style>
