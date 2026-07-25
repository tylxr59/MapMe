<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import {
    Archive,
    Database,
    List,
    LoaderCircle,
    LogOut,
    Map,
    MapPinned,
    Plus,
    Settings2,
    Tags
  } from '@lucide/svelte';
  import FilterBar from '$lib/components/filters/FilterBar.svelte';
  import PlaceMap from '$lib/components/map/PlaceMap.svelte';
  import PlaceDetails from '$lib/components/places/PlaceDetails.svelte';
  import PlaceEditor from '$lib/components/places/PlaceEditor.svelte';
  import PlaceList from '$lib/components/places/PlaceList.svelte';
  import type { MapPlace, PlaceDetail } from '$lib/types';

  let { data, form } = $props();
  let selectedId = $state<string | null>(null);
  let selectedPlace = $state<PlaceDetail | null>(null);
  let editorOpen = $state(false);
  let editing = $state(false);
  let draft = $state<{ latitude: number; longitude: number } | null>(null);
  let mobileTab = $state<'map' | 'list'>('map');
  let loadingDetail = $state(false);
  let locating = $state(false);
  let locationNotice = $state('');
  let mapCenter = $state({ latitude: 39.5, longitude: -98.35 });
  let locationNoticeTimer: ReturnType<typeof setTimeout> | undefined;

  const mapPlaces = $derived(
    data.places.map((place): MapPlace => ({
      id: place.id,
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      status: place.status,
      isFavorite: place.isFavorite,
      isArchived: place.isArchived,
      category: place.category
    }))
  );

  async function selectPlace(id: string) {
    selectedId = id;
    editorOpen = false;
    editing = false;
    loadingDetail = true;
    try {
      const response = await fetch(`/api/places/${id}`);
      const result = await response.json();
      if (response.ok) selectedPlace = result.place;
    } finally {
      loadingDetail = false;
    }
  }

  function startAdd(coordinates?: { latitude: number; longitude: number }) {
    draft = coordinates ?? mapCenter;
    selectedId = null;
    selectedPlace = null;
    editing = false;
    editorOpen = true;
  }

  function showLocationNotice(message: string) {
    locationNotice = message;
    clearTimeout(locationNoticeTimer);
    locationNoticeTimer = setTimeout(() => {
      locationNotice = '';
    }, 5_000);
  }

  function startAddAtCurrentLocation() {
    if (locating) return;
    if (!navigator.geolocation) {
      startAdd();
      showLocationNotice('Location is unavailable. Starting from the current map center.');
      return;
    }

    locating = true;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        locating = false;
        startAdd({ latitude: coords.latitude, longitude: coords.longitude });
      },
      () => {
        locating = false;
        startAdd();
        showLocationNotice('Could not access your location. Starting from the current map center.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000
      }
    );
  }

  function mapClicked(coordinates: { latitude: number; longitude: number }) {
    if (editorOpen && !editing) draft = coordinates;
    else startAdd(coordinates);
  }

  async function saved() {
    editorOpen = false;
    editing = false;
    draft = null;
    await invalidateAll();
  }

  async function deleted() {
    selectedId = null;
    selectedPlace = null;
    await invalidateAll();
  }
</script>

<svelte:head>
  <title>MapMe · Your saved places</title>
  <meta name="description" content="Save, organize, and remember interesting places." />
</svelte:head>

<div class="app-shell">
  <header class="topbar">
    <a class="brand" href="/"><MapPinned size={23} /><strong>MapMe</strong></a>
    <nav aria-label="Management">
      <a href="/manage/categories"><Settings2 size={16} /><span>Categories</span></a>
      <a href="/manage/tags"><Tags size={16} /><span>Tags</span></a>
      <a href="/manage/data"><Database size={16} /><span>Data</span></a>
      {#if data.config.authMode === 'password'}
        <form method="POST" action="/logout">
          <button aria-label="Sign out"><LogOut size={16} /><span>Sign out</span></button>
        </form>
      {/if}
    </nav>
    <button
      class="add"
      type="button"
      onclick={startAddAtCurrentLocation}
      disabled={locating}
      aria-busy={locating}
      >{#if locating}<LoaderCircle class="spin" size={18} /> Locating…{:else}<Plus size={18} /> Add place{/if}</button
    >
  </header>

  <main>
    <aside class:mobile-hidden={mobileTab !== 'list'} class="sidebar">
      <FilterBar filters={data.filters} categories={data.categories} tags={data.tags} />
      <PlaceList places={data.places} {selectedId} onselect={selectPlace} />
    </aside>
    <section class:mobile-hidden={mobileTab !== 'map'} class="map-pane">
      <PlaceMap
        places={mapPlaces}
        {selectedId}
        {draft}
        tileUrl={data.config.tileUrl}
        tileAttribution={data.config.tileAttribution}
        tileMaxZoom={data.config.tileMaxZoom}
        onselect={selectPlace}
        onmapclick={mapClicked}
        onviewportchange={(coordinates) => (mapCenter = coordinates)}
      />
      <div class="map-hint">Click the map to add a place</div>
    </section>
    {#if editorOpen && draft}
      <aside class="panel">
        <PlaceEditor
          place={editing ? selectedPlace : null}
          coordinates={draft}
          categories={data.categories}
          tags={data.tags}
          config={data.config}
          oncoordinates={(value) => (draft = value)}
          onclose={() => ((editorOpen = false), (draft = null))}
          onsaved={saved}
        />
      </aside>
    {:else if selectedPlace}
      <aside class="panel">
        <PlaceDetails
          place={selectedPlace}
          onedit={() => {
            editing = true;
            editorOpen = true;
            draft = { latitude: selectedPlace!.latitude, longitude: selectedPlace!.longitude };
          }}
          onclose={() => ((selectedPlace = null), (selectedId = null))}
          ondeleted={deleted}
          onchanged={() => selectPlace(selectedPlace!.id)}
        />
      </aside>
    {:else if loadingDetail}
      <aside class="panel loading">Loading place…</aside>
    {/if}
  </main>

  <nav class="mobile-nav" aria-label="Main view">
    <button class:active={mobileTab === 'map'} onclick={() => (mobileTab = 'map')}
      ><Map size={19} /> Map</button
    >
    <button class:active={mobileTab === 'list'} onclick={() => (mobileTab = 'list')}
      ><List size={19} /> Places</button
    >
    <button onclick={() => goto('/manage/data')}><Archive size={19} /> Data</button>
  </nav>

  {#if form?.message}<div class="toast error" role="alert">{form.message}</div>{/if}
  {#if locationNotice}<div class="toast" role="status">{locationNotice}</div>{/if}
</div>

<style>
  .app-shell {
    height: 100dvh;
    display: grid;
    grid-template-rows: 3.7rem minmax(0, 1fr);
    overflow: hidden;
  }
  .topbar {
    z-index: 1001;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.55rem 0.8rem 0.55rem 1rem;
    border-bottom: 1px solid var(--line);
    background: var(--cream);
    box-shadow: 0 1px 10px var(--shadow-soft);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--green-800);
    text-decoration: none;
  }
  .brand strong {
    color: var(--green-900);
    font-size: 1.05rem;
  }
  .topbar nav {
    display: flex;
    gap: 0.2rem;
    margin-left: auto;
  }
  .topbar nav a,
  .topbar nav button {
    height: 2.5rem;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    border: 0;
    border-radius: 0.55rem;
    padding: 0 0.6rem;
    color: var(--text-secondary);
    background: transparent;
    text-decoration: none;
    font-size: 0.78rem;
    font-weight: 700;
  }
  .topbar nav a:hover,
  .topbar nav button:hover {
    background: var(--surface-muted);
    color: var(--green-800);
  }
  .topbar nav form {
    margin: 0;
  }
  .add {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    border: 0;
    border-radius: 0.65rem;
    background: var(--accent-bg);
    color: var(--accent-text);
    padding: 0.65rem 0.8rem;
    font-weight: 780;
  }
  .add:disabled {
    cursor: wait;
    opacity: 0.78;
  }
  .add :global(.spin) {
    animation: spin 0.85s linear infinite;
  }
  main {
    position: relative;
    min-height: 0;
    display: grid;
    grid-template-columns: 380px minmax(0, 1fr);
  }
  .sidebar {
    min-height: 0;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--line);
    background: var(--cream);
    overflow: hidden;
  }
  .sidebar :global(.place-list) {
    flex: 1;
  }
  .map-pane {
    position: relative;
    z-index: 0;
    isolation: isolate;
    min-width: 0;
    min-height: 0;
  }
  .map-hint {
    position: absolute;
    z-index: 500;
    left: 50%;
    bottom: 1.1rem;
    transform: translateX(-50%);
    border: 1px solid #ffffffbb;
    border-radius: 999px;
    background: #183d2bd9;
    color: white;
    padding: 0.48rem 0.75rem;
    font-size: 0.74rem;
    pointer-events: none;
    box-shadow: 0 4px 16px #12302033;
  }
  .panel {
    position: absolute;
    z-index: 900;
    right: 0;
    top: 0;
    bottom: 0;
    width: min(430px, 42vw);
    border-left: 1px solid var(--line);
    box-shadow: -16px 0 38px var(--shadow-panel);
    background: var(--cream);
  }
  .panel.loading {
    display: grid;
    place-items: center;
    color: var(--ink-muted);
  }
  .mobile-nav {
    display: none;
  }
  .toast {
    position: fixed;
    z-index: 2000;
    left: 50%;
    bottom: 1rem;
    transform: translateX(-50%);
    border-radius: 0.6rem;
    padding: 0.7rem 1rem;
    background: #263a2d;
    color: white;
    box-shadow: 0 8px 30px #0003;
  }
  .toast.error {
    background: #8b2e29;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (max-width: 760px) {
    .app-shell {
      grid-template-rows: 3.55rem minmax(0, 1fr) 3.6rem;
    }
    .topbar {
      padding-left: 0.75rem;
    }
    .topbar nav {
      display: none;
    }
    .add {
      margin-left: auto;
    }
    main {
      display: block;
      min-height: 0;
    }
    .sidebar,
    .map-pane {
      position: absolute;
      inset: 0;
    }
    .mobile-hidden {
      display: none;
    }
    .panel {
      position: fixed;
      z-index: 1200;
      top: auto;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: min(82dvh, 760px);
      border: 1px solid var(--line);
      border-radius: 1rem 1rem 0 0;
      overflow: hidden;
      box-shadow: 0 -16px 38px var(--shadow-panel);
    }
    .mobile-nav {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      border-top: 1px solid var(--line);
      background: var(--cream);
    }
    .mobile-nav button {
      display: grid;
      justify-items: center;
      align-content: center;
      gap: 0.1rem;
      border: 0;
      background: transparent;
      color: var(--ink-muted);
      font-size: 0.65rem;
      font-weight: 700;
    }
    .mobile-nav button.active {
      color: var(--green-800);
    }
  }
  @media (max-width: 430px) {
    .add {
      width: 2.5rem;
      height: 2.5rem;
      justify-content: center;
      padding: 0;
      font-size: 0;
    }
  }
</style>
