<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { LoaderCircle, LogOut, MapPinned, Menu, Plus, Settings2 } from '@lucide/svelte';
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
  let sidebarCollapsed = $state(false);
  let mobileSidebarOpen = $state(false);
  let loadingDetail = $state(false);
  let locating = $state(false);
  let locationNotice = $state('');
  let mapCenter = $state({ latitude: 39.5, longitude: -98.35 });
  let locationNoticeTimer: ReturnType<typeof setTimeout> | undefined;
  let panelOpen = $derived(
    (editorOpen && Boolean(draft)) || Boolean(selectedPlace) || loadingDetail
  );

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
    mobileSidebarOpen = false;
    loadingDetail = true;
    try {
      const response = await fetch(`/api/places/${id}`, { cache: 'no-store' });
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

  function toggleSidebar() {
    if (window.matchMedia('(max-width: 760px)').matches) {
      mobileSidebarOpen = !mobileSidebarOpen;
      return;
    }
    sidebarCollapsed = !sidebarCollapsed;
  }

  async function saved(placeId: string) {
    editorOpen = false;
    editing = false;
    draft = null;
    await invalidateAll();
    await selectPlace(placeId);
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
  <main class:collapsed={sidebarCollapsed} class:drawer-open={mobileSidebarOpen}>
    <aside class="sidebar" aria-label="Places sidebar">
      <header class="sidebar-header">
        <button
          class="menu-button"
          type="button"
          onclick={toggleSidebar}
          aria-label="Collapse sidebar"
          aria-expanded="true"
          aria-controls="places-sidebar-content"
        >
          <Menu size={21} />
        </button>
        <a class="brand" href="/">
          <span class="brand-icon"><MapPinned size={20} /></span>
          <strong>MapMe</strong>
        </a>
      </header>
      <div class="sidebar-content" id="places-sidebar-content">
        <FilterBar filters={data.filters} categories={data.categories} />
        <PlaceList places={data.places} {selectedId} onselect={selectPlace} />
      </div>
      <footer class="sidebar-footer">
        <a class="settings" href="/manage/general">
          <Settings2 size={18} />
          <span>Settings</span>
        </a>
        {#if data.config.authMode === 'password'}
          <form method="POST" action="/logout">
            <button type="submit"><LogOut size={18} /><span>Sign out</span></button>
          </form>
        {/if}
      </footer>
    </aside>

    {#if sidebarCollapsed}
      <header class="floating-header desktop-launcher">
        <button
          class="menu-button"
          type="button"
          onclick={toggleSidebar}
          aria-label="Open sidebar"
          aria-expanded="false"
          aria-controls="places-sidebar-content"
        >
          <Menu size={21} />
        </button>
        <a class="brand" href="/">
          <span class="brand-icon"><MapPinned size={20} /></span>
          <strong>MapMe</strong>
        </a>
      </header>
    {/if}

    {#if !mobileSidebarOpen}
      <header class="floating-header mobile-launcher">
        <button
          class="menu-button"
          type="button"
          onclick={toggleSidebar}
          aria-label="Open sidebar"
          aria-expanded="false"
          aria-controls="places-sidebar-content"
        >
          <Menu size={21} />
        </button>
        <a class="brand" href="/">
          <span class="brand-icon"><MapPinned size={20} /></span>
          <strong>MapMe</strong>
        </a>
      </header>
    {/if}

    {#if mobileSidebarOpen}
      <button
        class="sidebar-backdrop"
        type="button"
        onclick={() => (mobileSidebarOpen = false)}
        aria-label="Close sidebar"
      ></button>
    {/if}

    <section class="map-pane" class:panel-open={panelOpen} inert={mobileSidebarOpen}>
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
      <button
        class="add"
        type="button"
        onclick={startAddAtCurrentLocation}
        disabled={locating}
        aria-busy={locating}
        >{#if locating}<LoaderCircle class="spin" size={20} /> Locating…{:else}<Plus size={21} /> Add
          place{/if}</button
      >
    </section>
    {#if editorOpen && draft}
      <aside class="panel">
        <PlaceEditor
          place={editing ? selectedPlace : null}
          coordinates={draft}
          categories={data.categories}
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

  {#if form?.message}<div class="toast error" role="alert">{form.message}</div>{/if}
  {#if locationNotice}<div class="toast" role="status">{locationNotice}</div>{/if}
</div>

<style>
  .app-shell {
    height: 100dvh;
    overflow: hidden;
  }
  main {
    --panel-width: min(430px, 42vw);
    position: relative;
    height: 100%;
    min-height: 0;
    display: grid;
    grid-template-columns: 380px minmax(0, 1fr);
    transition: grid-template-columns 220ms ease;
  }
  main.collapsed {
    grid-template-columns: 0 minmax(0, 1fr);
  }
  .sidebar-header,
  .floating-header {
    min-height: 3.75rem;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--line);
    background: var(--cream);
    box-shadow: 0 1px 10px var(--shadow-soft);
  }
  .menu-button {
    width: 2.6rem;
    height: 2.6rem;
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    border: 0;
    border-radius: 0.7rem;
    background: transparent;
    color: var(--text-secondary);
  }
  .menu-button:hover {
    background: var(--surface-muted);
    color: var(--green-800);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    color: var(--green-800);
    text-decoration: none;
  }
  .brand-icon {
    width: 2rem;
    height: 2rem;
    display: grid;
    place-items: center;
    border-radius: 0.65rem;
    background: var(--accent-bg);
    color: var(--accent-text);
  }
  .brand strong {
    color: var(--green-900);
    font-size: 1.05rem;
  }
  .add {
    position: absolute;
    z-index: 600;
    right: 1.25rem;
    bottom: 2.15rem;
    min-height: 3.25rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: 0;
    border-radius: 999px;
    background: var(--accent-bg);
    color: var(--accent-text);
    padding: 0.75rem 1.05rem;
    font-weight: 780;
    box-shadow: 0 8px 24px #102a1d40;
  }
  .add:hover {
    background: var(--green-700);
    transform: translateY(-1px);
    box-shadow: 0 10px 28px #102a1d4d;
  }
  .add:disabled {
    cursor: wait;
    opacity: 0.78;
    transform: none;
  }
  .add :global(.spin) {
    animation: spin 0.85s linear infinite;
  }
  .sidebar {
    position: relative;
    z-index: 1000;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--line);
    background: var(--cream);
    overflow: hidden;
    transition:
      transform 220ms ease,
      visibility 220ms;
  }
  main.collapsed .sidebar {
    visibility: hidden;
    transform: translateX(-100%);
  }
  .sidebar-content {
    min-height: 0;
    display: flex;
    flex: 1;
    flex-direction: column;
  }
  .sidebar-content :global(.place-list) {
    flex: 1;
  }
  .sidebar-footer {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.7rem;
    border-top: 1px solid var(--line);
    background: var(--cream);
  }
  .sidebar-footer a,
  .sidebar-footer button {
    min-height: 2.7rem;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    border: 0;
    border-radius: 0.7rem;
    padding: 0.65rem 0.75rem;
    background: transparent;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.82rem;
    font-weight: 750;
  }
  .sidebar-footer a:hover,
  .sidebar-footer button:hover {
    background: var(--surface-muted);
    color: var(--green-800);
  }
  .sidebar-footer .settings {
    flex: 1;
  }
  .sidebar-footer form {
    margin: 0;
  }
  .floating-header {
    position: absolute;
    z-index: 800;
    top: 0.75rem;
    left: 0.75rem;
    min-height: auto;
    border: 1px solid var(--line);
    border-radius: 0.85rem;
    padding: 0.35rem;
    box-shadow: 0 8px 24px var(--shadow-panel);
  }
  .floating-header .brand {
    padding-right: 0.55rem;
  }
  .mobile-launcher {
    display: none;
  }
  .sidebar-backdrop {
    display: none;
  }
  .map-pane {
    position: relative;
    z-index: 0;
    isolation: isolate;
    min-width: 0;
    min-height: 0;
    transition: margin-right 220ms ease;
  }
  .map-pane.panel-open {
    margin-right: var(--panel-width);
  }
  .map-hint {
    position: absolute;
    z-index: 500;
    left: 50%;
    bottom: 1.25rem;
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
    width: var(--panel-width);
    border-left: 1px solid var(--line);
    box-shadow: -16px 0 38px var(--shadow-panel);
    background: var(--cream);
  }
  .panel.loading {
    display: grid;
    place-items: center;
    color: var(--ink-muted);
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
    main {
      display: block;
    }
    .sidebar {
      position: fixed;
      z-index: 1100;
      inset: 0 auto 0 0;
      width: min(380px, calc(100vw - 3rem));
      visibility: hidden;
      transform: translateX(-100%);
      box-shadow: 16px 0 38px var(--shadow-panel);
    }
    main.collapsed .sidebar {
      visibility: hidden;
      transform: translateX(-100%);
    }
    main.drawer-open .sidebar,
    main.collapsed.drawer-open .sidebar {
      visibility: visible;
      transform: translateX(0);
    }
    .desktop-launcher {
      display: none;
    }
    .mobile-launcher {
      display: flex;
    }
    .sidebar-backdrop {
      position: fixed;
      z-index: 1000;
      inset: 0;
      display: block;
      border: 0;
      background: #07130c66;
      cursor: default;
    }
    .map-pane {
      position: absolute;
      inset: 0;
    }
    .map-pane.panel-open {
      margin-right: 0;
    }
    .map-hint {
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
    .add {
      right: 1rem;
      bottom: 2rem;
    }
  }
</style>
