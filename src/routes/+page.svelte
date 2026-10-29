<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import {
    LoaderCircle,
    LogOut,
    MousePointerClick,
    PanelLeftClose,
    PanelLeftOpen,
    Plus,
    Settings2
  } from '@lucide/svelte';
  import BrandMark from '$lib/components/brand/BrandMark.svelte';
  import FilterBar from '$lib/components/filters/FilterBar.svelte';
  import PlaceMap from '$lib/components/map/PlaceMap.svelte';
  import PlaceDetails from '$lib/components/places/PlaceDetails.svelte';
  import PlaceEditor from '$lib/components/places/PlaceEditor.svelte';
  import PlaceList from '$lib/components/places/PlaceList.svelte';
  import type { MapPlace, PlaceDetail } from '$lib/types';
  import { onDestroy } from 'svelte';

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
  let detailRequest: AbortController | null = null;
  let panelOpen = $derived(
    (editorOpen && Boolean(draft)) || Boolean(selectedPlace) || loadingDetail
  );

  const addingPlace = $derived(editorOpen && Boolean(draft) && !editing);
  const visibleCount = $derived(data.places.length);

  const mapPlaces = $derived(
    data.places.map((place): MapPlace => ({
      id: place.id,
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      isFavorite: place.isFavorite,
      isArchived: place.isArchived,
      category: place.category
    }))
  );

  async function selectPlace(id: string) {
    detailRequest?.abort();
    const controller = new AbortController();
    detailRequest = controller;
    selectedId = id;
    editorOpen = false;
    editing = false;
    mobileSidebarOpen = false;
    loadingDetail = true;
    try {
      const response = await fetch(`/api/places/${id}`, {
        cache: 'no-store',
        signal: controller.signal
      });
      const result = await response.json();
      if (response.ok && detailRequest === controller && selectedId === id) {
        selectedPlace = result.place;
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        showLocationNotice('Could not load that place.');
      }
    } finally {
      if (detailRequest === controller) {
        detailRequest = null;
        loadingDetail = false;
      }
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

  async function changed() {
    if (!selectedPlace) return;
    const placeId = selectedPlace.id;
    await invalidateAll();
    await selectPlace(placeId);
  }

  onDestroy(() => {
    detailRequest?.abort();
    clearTimeout(locationNoticeTimer);
  });
</script>

<svelte:head>
  <title>MapMe · Your saved places</title>
  <meta name="description" content="Save, organize, and remember interesting places." />
</svelte:head>

<div class="app-shell">
  <main class:collapsed={sidebarCollapsed} class:drawer-open={mobileSidebarOpen}>
    <aside class="sidebar" aria-label="Places sidebar">
      <header class="sidebar-header">
        <a class="brand" href="/">
          <BrandMark size={34} />
          <span class="wordmark">MapMe</span>
        </a>
        <button
          class="icon-button"
          type="button"
          onclick={toggleSidebar}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          aria-expanded="true"
          aria-controls="places-sidebar-content"
        >
          <PanelLeftClose size={19} />
        </button>
      </header>
      <div class="sidebar-content" id="places-sidebar-content">
        <FilterBar filters={data.filters} categories={data.categories} lists={data.lists} />
        <PlaceList places={data.places} {selectedId} onselect={selectPlace} />
      </div>
      <footer class="sidebar-footer">
        <a class="settings" href="/manage/general">
          <Settings2 size={17} />
          <span>Settings</span>
        </a>
        {#if data.config.authMode === 'password'}
          <form method="POST" action="/logout">
            <button type="submit"><LogOut size={17} /><span>Sign out</span></button>
          </form>
        {/if}
        <span class="version">v{data.config.appVersion}</span>
      </footer>
    </aside>

    {#if sidebarCollapsed}
      <header class="floating-header desktop-launcher">
        <button
          class="icon-button"
          type="button"
          onclick={toggleSidebar}
          aria-label="Open sidebar"
          title="Open sidebar"
          aria-expanded="false"
          aria-controls="places-sidebar-content"
        >
          <PanelLeftOpen size={19} />
        </button>
        <a class="brand" href="/">
          <BrandMark size={28} />
          <span class="wordmark">MapMe</span>
        </a>
        <span class="launcher-count">{visibleCount}</span>
      </header>
    {/if}

    {#if !mobileSidebarOpen}
      <header class="floating-header mobile-launcher">
        <button
          class="icon-button"
          type="button"
          onclick={toggleSidebar}
          aria-label="Open sidebar"
          aria-expanded="false"
          aria-controls="places-sidebar-content"
        >
          <PanelLeftOpen size={19} />
        </button>
        <a class="brand" href="/">
          <BrandMark size={28} />
          <span class="wordmark">MapMe</span>
        </a>
        <span class="launcher-count">{visibleCount} {visibleCount === 1 ? 'place' : 'places'}</span>
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
        tileProxyEnabled={data.config.tileProxyEnabled}
        onselect={selectPlace}
        onmapclick={mapClicked}
        onviewportchange={(coordinates) => (mapCenter = coordinates)}
      />
      <div class="map-hint" class:drafting={addingPlace}>
        <MousePointerClick size={14} />
        {#if addingPlace}
          Click the map or drag the pin to move it
        {:else}
          Click the map to add a place
        {/if}
      </div>
      {#if !panelOpen}
        <button
          class="add"
          type="button"
          onclick={startAddAtCurrentLocation}
          disabled={locating}
          aria-busy={locating}
        >
          {#if locating}
            <LoaderCircle class="spin" size={19} /> <span>Locating…</span>
          {:else}
            <Plus size={20} strokeWidth={2.5} /> <span>Add place</span>
          {/if}
        </button>
      {/if}
    </section>
    {#if editorOpen && draft}
      <aside class="panel">
        <PlaceEditor
          place={editing ? selectedPlace : null}
          coordinates={draft}
          categories={data.categories}
          lists={data.lists}
          config={data.config}
          oncoordinates={(value) => (draft = value)}
          onclose={() => ((editorOpen = false), (draft = null))}
          onsaved={saved}
        />
      </aside>
    {:else if selectedPlace}
      <aside class="panel">
        {#key selectedPlace.id}
          <PlaceDetails
            place={selectedPlace}
            onedit={() => {
              editing = true;
              editorOpen = true;
              draft = { latitude: selectedPlace!.latitude, longitude: selectedPlace!.longitude };
            }}
            onclose={() => ((selectedPlace = null), (selectedId = null))}
            ondeleted={deleted}
            onchanged={changed}
          />
        {/key}
      </aside>
    {:else if loadingDetail}
      <aside class="panel loading" aria-busy="true">
        <div class="skeleton">
          <span class="sk sk-hero"></span>
          <span class="sk sk-title"></span>
          <span class="sk sk-line"></span>
          <span class="sk sk-actions"></span>
          <span class="sk sk-card"></span>
        </div>
        <span class="sr-only">Loading place…</span>
      </aside>
    {/if}
  </main>

  <div class="toasts" aria-live="polite">
    {#if form?.message}<div class="toast error" role="alert">{form.message}</div>{/if}
    {#if locationNotice}<div class="toast" role="status">{locationNotice}</div>{/if}
  </div>
</div>

<style>
  .app-shell {
    height: 100dvh;
    overflow: hidden;
    background: var(--paper);
  }
  main {
    --sidebar-width: 384px;
    --panel-width: min(440px, 42vw);
    position: relative;
    height: 100%;
    min-height: 0;
    display: grid;
    grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
    transition: grid-template-columns 280ms var(--ease-out);
  }
  main.collapsed {
    grid-template-columns: 0 minmax(0, 1fr);
  }

  /* Shared header chrome ---------------------------------------------------------------- */
  .sidebar-header,
  .floating-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    background: var(--cream);
  }
  .sidebar-header {
    min-height: 4rem;
    justify-content: space-between;
    padding: 0.9rem 0.75rem 0.4rem 1.1rem;
  }
  .icon-button {
    width: 2.4rem;
    height: 2.4rem;
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--ink-muted);
    transition:
      background 120ms ease,
      color 120ms ease;
  }
  .icon-button:hover {
    background: var(--surface-muted);
    color: var(--text);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: var(--text);
    text-decoration: none;
  }
  .wordmark {
    font-family: var(--font-display);
    font-size: 1.45rem;
    font-weight: 600;
    font-variation-settings: 'opsz' 72;
    letter-spacing: -0.012em;
    line-height: 1;
  }

  /* Sidebar ---------------------------------------------------------------------------- */
  .sidebar {
    position: relative;
    z-index: 1000;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--line);
    background: var(--cream) var(--grain);
    overflow: hidden;
    transition:
      transform 280ms var(--ease-out),
      visibility 280ms;
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
  .sidebar-footer {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.55rem 0.6rem;
    border-top: 1px solid var(--line);
  }
  .sidebar-footer a,
  .sidebar-footer button {
    min-height: 2.4rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: 0;
    border-radius: var(--radius-sm);
    padding: 0.5rem 0.7rem;
    background: transparent;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.84rem;
    font-weight: 550;
    transition:
      background 120ms ease,
      color 120ms ease;
  }
  .sidebar-footer a:hover,
  .sidebar-footer button:hover {
    background: var(--surface-muted);
    color: var(--text);
  }
  .sidebar-footer form {
    margin: 0;
  }
  .version {
    margin-left: auto;
    padding-right: 0.5rem;
    color: var(--ink-muted);
    font-family: var(--font-mono);
    font-size: 0.68rem;
  }

  /* Floating launchers (collapsed sidebar / mobile) -------------------------------------- */
  .floating-header {
    position: absolute;
    z-index: 800;
    top: 1rem;
    left: 1rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    padding: 0.3rem 0.85rem 0.3rem 0.3rem;
    background: color-mix(in srgb, var(--cream) 92%, transparent);
    backdrop-filter: blur(12px) saturate(1.4);
    box-shadow: var(--shadow-float);
    animation: float-in 320ms var(--ease-out);
  }
  .floating-header .wordmark {
    font-size: 1.2rem;
  }
  .launcher-count {
    min-width: 1.6rem;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    background: var(--surface-muted);
    color: var(--text-secondary);
    font-size: 0.72rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
  .mobile-launcher {
    display: none;
  }
  .sidebar-backdrop {
    display: none;
  }

  /* Map ------------------------------------------------------------------------------------ */
  .map-pane {
    position: relative;
    z-index: 0;
    isolation: isolate;
    min-width: 0;
    min-height: 0;
    transition: margin-right 300ms var(--ease-out);
  }
  .map-pane.panel-open {
    margin-right: var(--panel-width);
  }
  .map-hint {
    position: absolute;
    z-index: 500;
    left: 50%;
    bottom: 1.6rem;
    display: flex;
    align-items: center;
    gap: 0.45rem;
    transform: translateX(-50%);
    border-radius: 999px;
    background: color-mix(in srgb, var(--text) 82%, transparent);
    backdrop-filter: blur(8px);
    color: var(--paper);
    padding: 0.5rem 0.9rem 0.5rem 0.75rem;
    font-size: 0.76rem;
    font-weight: 500;
    white-space: nowrap;
    pointer-events: none;
    box-shadow: 0 8px 20px -6px #0000004d;
    transition: background 200ms ease;
  }
  .map-hint.drafting {
    background: var(--vermilion);
    color: white;
  }
  .add {
    position: absolute;
    z-index: 600;
    right: 1.25rem;
    bottom: 1.5rem;
    min-height: 3.3rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: 0;
    border-radius: 999px;
    background: var(--brand);
    color: var(--accent-text);
    padding: 0.8rem 1.35rem 0.8rem 1.1rem;
    font-size: 0.95rem;
    font-weight: 650;
    letter-spacing: -0.005em;
    box-shadow:
      inset 0 1px 0 #ffffff26,
      0 1px 2px #0000001f,
      0 12px 28px -8px color-mix(in srgb, var(--brand) 70%, #000);
    transition:
      transform 200ms var(--ease-spring),
      background 150ms ease,
      box-shadow 200ms ease;
    animation: float-in 320ms var(--ease-out);
  }
  .add:hover {
    background: var(--brand-hover);
    transform: translateY(-2px);
  }
  .add:active {
    transform: translateY(0) scale(0.98);
  }
  .add:disabled {
    cursor: wait;
    opacity: 0.85;
    transform: none;
  }

  /* Detail / editor panel ------------------------------------------------------------------ */
  .panel {
    position: absolute;
    z-index: 900;
    right: 0;
    top: 0;
    bottom: 0;
    width: var(--panel-width);
    border-left: 1px solid var(--line);
    background: var(--cream);
    box-shadow: -24px 0 48px -24px var(--shadow-panel);
    animation: panel-in 300ms var(--ease-out);
  }
  .panel.loading {
    overflow: hidden;
  }
  .skeleton {
    display: grid;
    gap: 0.9rem;
    padding: 0 0 1rem;
  }
  .sk {
    display: block;
    margin: 0 1.25rem;
    border-radius: var(--radius-sm);
    background: linear-gradient(
      100deg,
      var(--surface-muted) 30%,
      color-mix(in srgb, var(--surface-muted) 40%, var(--cream)) 50%,
      var(--surface-muted) 70%
    );
    background-size: 300% 100%;
    animation: shimmer 1.2s linear infinite;
  }
  .sk-hero {
    height: 9rem;
    margin: 0;
    border-radius: 0;
  }
  .sk-title {
    width: 70%;
    height: 1.9rem;
  }
  .sk-line {
    width: 45%;
    height: 0.9rem;
  }
  .sk-actions {
    height: 3.6rem;
  }
  .sk-card {
    height: 10rem;
  }

  /* Toasts --------------------------------------------------------------------------------- */
  .toasts {
    position: fixed;
    z-index: 2000;
    left: 50%;
    bottom: 1.25rem;
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    transform: translateX(-50%);
    pointer-events: none;
  }
  .toast {
    max-width: min(32rem, calc(100vw - 2rem));
    border-radius: var(--radius-md);
    padding: 0.75rem 1rem;
    background: var(--text);
    color: var(--paper);
    font-size: 0.86rem;
    font-weight: 500;
    box-shadow: 0 16px 36px -10px #00000073;
    animation: toast-in 320ms var(--ease-spring);
  }
  .toast.error {
    background: var(--danger);
    color: white;
  }

  @keyframes panel-in {
    from {
      opacity: 0;
      transform: translateX(24px);
    }
  }
  @keyframes float-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.96);
    }
  }
  @keyframes shimmer {
    to {
      background-position: -150% 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    main,
    .sidebar,
    .map-pane,
    .panel,
    .add,
    .floating-header,
    .toast,
    .sk {
      animation: none;
      transition: none;
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
      width: min(384px, calc(100vw - 3rem));
      visibility: hidden;
      transform: translateX(-100%);
      border-radius: 0 var(--radius-xl) var(--radius-xl) 0;
      box-shadow: 24px 0 48px -12px var(--shadow-panel);
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
      top: max(0.75rem, env(safe-area-inset-top));
      left: 0.75rem;
    }
    .sidebar-backdrop {
      position: fixed;
      z-index: 1000;
      inset: 0;
      display: block;
      border: 0;
      background: #0b0f0d73;
      backdrop-filter: blur(2px);
      cursor: default;
      animation: float-in 200ms ease;
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
      height: min(86dvh, 780px);
      border: 1px solid var(--line);
      border-bottom: 0;
      border-radius: var(--radius-xl) var(--radius-xl) 0 0;
      overflow: hidden;
      box-shadow: 0 -20px 48px -12px var(--shadow-panel);
      animation-name: sheet-in;
    }
    .add {
      right: 1rem;
      bottom: max(1.5rem, calc(env(safe-area-inset-bottom) + 1rem));
    }
    @keyframes sheet-in {
      from {
        transform: translateY(40px);
        opacity: 0;
      }
    }
  }
</style>
