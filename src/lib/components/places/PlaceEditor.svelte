<script lang="ts">
  import { enhance } from '$app/forms';
  import { Check, Link2, LoaderCircle, LocateFixed, Plus, Search, Trash2, X } from '@lucide/svelte';
  import type { CategoryDTO, PlaceDetail, PlaceListDTO, SafeClientConfig } from '$lib/types';

  let {
    place = null,
    coordinates,
    categories,
    lists,
    config,
    oncoordinates,
    onclose,
    onsaved
  }: {
    place?: PlaceDetail | null;
    coordinates: { latitude: number; longitude: number };
    categories: CategoryDTO[];
    lists: PlaceListDTO[];
    config: SafeClientConfig;
    oncoordinates: (coordinates: { latitude: number; longitude: number }) => void;
    onclose: () => void;
    onsaved: (placeId: string) => void;
  } = $props();

  let latitude = $state(0);
  let longitude = $state(0);
  let address = $state('');
  let initialized = false;
  let geocodeQuery = $state('');
  let geocodeResults = $state<Array<{ displayName: string; latitude: number; longitude: number }>>(
    []
  );
  let geocodeError = $state('');
  let geocoding = $state(false);
  let geocodeController: AbortController | null = null;
  let links = $state<Array<{ title: string; url: string }>>([]);
  const linksJson = $derived(
    JSON.stringify(links.filter((link) => link.title.trim() || link.url.trim()))
  );

  $effect(() => {
    if (!initialized) {
      latitude = place?.latitude ?? coordinates.latitude;
      longitude = place?.longitude ?? coordinates.longitude;
      address = place?.address ?? '';
      links = place?.links.map((link) => ({ title: link.title ?? '', url: link.url })) ?? [];
      initialized = true;
    }
    if (!place) {
      latitude = coordinates.latitude;
      longitude = coordinates.longitude;
    }
  });

  function coordinatesChanged() {
    if (Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))) {
      oncoordinates({ latitude: Number(latitude), longitude: Number(longitude) });
    }
  }

  $effect(() => {
    const query = geocodeQuery.trim();
    if (!config.geocodingAutocomplete || query.length < 3) return;
    const timer = setTimeout(() => void searchAddress(query), 750);
    return () => clearTimeout(timer);
  });

  async function runGeocode(url: string) {
    geocodeController?.abort();
    const controller = new AbortController();
    geocodeController = controller;
    geocoding = true;
    geocodeError = '';
    try {
      const response = await fetch(url, { signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Address search failed');
      if (geocodeController === controller) geocodeResults = result.results;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      geocodeError = error instanceof Error ? error.message : 'Address search failed';
    } finally {
      if (geocodeController === controller) {
        geocodeController = null;
        geocoding = false;
      }
    }
  }

  async function searchAddress(searchQuery = geocodeQuery.trim()) {
    const query = searchQuery.trim();
    if (query.length < 3) return;
    await runGeocode(`/api/geocoding/search?q=${encodeURIComponent(query)}`);
  }

  async function reverseGeocode() {
    await runGeocode(`/api/geocoding/reverse?lat=${latitude}&lng=${longitude}`);
  }

  function chooseGeocode(result: (typeof geocodeResults)[number]) {
    latitude = result.latitude;
    longitude = result.longitude;
    address = result.displayName;
    oncoordinates({ latitude, longitude });
    geocodeResults = [];
  }

  function addLink() {
    links.push({ title: '', url: '' });
  }

  function removeLink(index: number) {
    links.splice(index, 1);
  }
</script>

<section class="editor" aria-label={place ? 'Edit place' : 'Add a place'}>
  <header>
    <div>
      <span>{place ? 'Update your place' : 'Pin something memorable'}</span>
      <h2>{place ? 'Edit place' : 'Add a place'}</h2>
    </div>
    <button type="button" class="icon-button" onclick={onclose} aria-label="Close"><X /></button>
  </header>

  <form
    method="POST"
    action={place ? '?/updatePlace' : '?/createPlace'}
    use:enhance={() => {
      return async ({ result, update }) => {
        await update();
        if (result.type === 'success') {
          const placeId =
            result.data &&
            typeof result.data === 'object' &&
            'placeId' in result.data &&
            typeof result.data.placeId === 'string'
              ? result.data.placeId
              : place?.id;
          if (placeId) onsaved(placeId);
        }
      };
    }}
  >
    {#if place}<input type="hidden" name="id" value={place.id} />{/if}
    <input type="hidden" name="isFavorite" value={place?.isFavorite ? 'true' : 'false'} />
    <input type="hidden" name="links" value={linksJson} />
    <div class="fields">
      <label class="wide"
        >Name <input
          name="name"
          required
          maxlength="200"
          value={place?.name ?? ''}
          placeholder="What is this place?"
        /></label
      >

      <div class="coordinate-grid">
        <label
          >Latitude
          <input
            name="latitude"
            type="number"
            step="any"
            min="-90"
            max="90"
            bind:value={latitude}
            oninput={coordinatesChanged}
            required
          />
        </label>
        <label
          >Longitude
          <input
            name="longitude"
            type="number"
            step="any"
            min="-180"
            max="180"
            bind:value={longitude}
            oninput={coordinatesChanged}
            required
          />
        </label>
        {#if config.geocodingEnabled}
          <button
            type="button"
            class="coordinate-lookup"
            onclick={reverseGeocode}
            disabled={geocoding}
            title="Look up this point"
            aria-label="Look up address for these coordinates"
          >
            {#if geocoding}<LoaderCircle class="spin" size={18} />{:else}<LocateFixed
                size={18}
              />{/if}
          </button>
        {:else}
          <LocateFixed size={18} aria-label="Coordinates update the draft marker" />
        {/if}
      </div>

      {#if config.geocodingEnabled}
        <div class="geocoder">
          <label class="wide"
            >Find an address or POI
            <div class="search-box">
              <input
                bind:value={geocodeQuery}
                placeholder="Search OpenStreetMap…"
                onkeydown={(event) =>
                  event.key === 'Enter' && (event.preventDefault(), searchAddress())}
              />
              <button
                type="button"
                onclick={() => searchAddress()}
                disabled={geocoding || geocodeQuery.trim().length < 3}
              >
                {#if geocoding}<LoaderCircle class="spin" size={16} />{:else}<Search
                    size={16}
                  />{/if}
                Search
              </button>
            </div>
          </label>
          {#if geocodeError}<p class="field-error">{geocodeError}</p>{/if}
          {#if geocodeResults.length}
            <div class="geocode-results">
              {#each geocodeResults as result}
                <button type="button" onclick={() => chooseGeocode(result)}
                  >{result.displayName}</button
                >
              {/each}
              <small>Search data © OpenStreetMap contributors</small>
            </div>
          {/if}
        </div>
      {/if}

      <label class="wide"
        >Address <input
          name="address"
          maxlength="500"
          bind:value={address}
          placeholder="Optional manual address"
        /></label
      >
      <label
        >Category
        <select name="categoryId" required value={place?.category.id ?? categories.at(-1)?.id}>
          {#each categories as category}<option value={category.id}>{category.name}</option>{/each}
        </select>
      </label>
      <label
        >List
        <select
          name="listId"
          required
          value={place?.list.id ?? lists.find((list) => list.isSystem)?.id ?? lists.at(-1)?.id}
        >
          {#each lists as list}<option value={list.id}>{list.name}</option>{/each}
        </select>
      </label>
      <label
        >Rating
        <select name="rating" value={place?.rating ?? ''}>
          <option value="">Not rated</option>
          <option value="1">1 star</option>
          <option value="2">2 stars</option>
          <option value="3">3 stars</option>
          <option value="4">4 stars</option>
          <option value="5">5 stars</option>
        </select>
      </label>
      <label
        >Date visited
        <input name="dateVisited" type="date" value={place?.dateVisited ?? ''} /></label
      >
      <div class="links-editor wide">
        <div class="links-heading">
          <span><Link2 size={15} /> Links</span>
          <button type="button" onclick={addLink}><Plus size={15} /> Add link</button>
        </div>
        {#each links as link, index}
          <div class="link-row">
            <label>
              Title
              <input
                maxlength="200"
                bind:value={link.title}
                placeholder="Optional label"
                aria-label={`Link ${index + 1} title`}
              />
            </label>
            <label>
              URL
              <input
                type="url"
                maxlength="2048"
                bind:value={link.url}
                placeholder="https://…"
                aria-label={`Link ${index + 1} URL`}
              />
            </label>
            <button
              type="button"
              class="remove-link"
              onclick={() => removeLink(index)}
              aria-label={`Remove link ${index + 1}`}><Trash2 size={16} /></button
            >
          </div>
        {:else}
          <p class="links-empty">
            Add useful pages, booking details, or references for this place.
          </p>
        {/each}
      </div>
      <label class="wide"
        >Notes
        <textarea
          name="description"
          maxlength="20000"
          rows="5"
          placeholder="What do you want to remember?">{place?.description ?? ''}</textarea
        >
      </label>
      <div class="states wide">
        <label class="check"
          ><input type="checkbox" name="isArchived" checked={place?.isArchived} /> Archived</label
        >
      </div>
    </div>
    <footer>
      <button type="button" class="secondary" onclick={onclose}><X size={16} /> Cancel</button>
      <button type="submit" class="primary"
        ><Check size={17} /> {place ? 'Save changes' : 'Save place'}</button
      >
    </footer>
  </form>
</section>

<style>
  .editor {
    height: 100%;
    display: flex;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
    background: var(--cream);
  }
  header {
    flex: 0 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: start;
    padding: 1rem 1.1rem;
    border-bottom: 1px solid var(--line);
    background: var(--header-translucent);
    backdrop-filter: blur(10px);
  }
  header span {
    color: var(--green-700);
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  h2 {
    margin: 0.15rem 0 0;
    font-size: 1.3rem;
  }
  .icon-button {
    border: 0;
    background: transparent;
    color: var(--text-secondary);
    padding: 0.35rem;
  }
  form {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .fields {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-content: start;
    gap: 0.85rem;
    padding: 1rem 1.1rem 1.25rem;
  }
  label {
    display: grid;
    align-content: start;
    gap: 0.3rem;
    color: var(--text-secondary);
    font-size: 0.75rem;
    font-weight: 750;
  }
  input,
  select,
  textarea {
    width: 100%;
    border: 1px solid var(--input-border);
    border-radius: 0.58rem;
    padding: 0.63rem 0.7rem;
    background: var(--input-bg);
    color: var(--text);
    outline: 0;
  }
  input:focus,
  select:focus,
  textarea:focus {
    border-color: var(--green-700);
    box-shadow: 0 0 0 3px var(--focus-ring);
  }
  textarea {
    resize: vertical;
    line-height: 1.45;
  }
  .wide,
  .states,
  .geocoder,
  .coordinate-grid {
    grid-column: 1 / -1;
  }
  .coordinate-grid {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 0.6rem;
    align-items: end;
  }
  .coordinate-grid > :global(svg) {
    margin-bottom: 0.7rem;
    color: var(--green-700);
  }
  .coordinate-lookup {
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    margin-bottom: 0.05rem;
    border: 1px solid var(--input-border);
    border-radius: 0.58rem;
    background: var(--input-bg);
    color: var(--green-700);
  }
  .coordinate-lookup:disabled {
    opacity: 0.55;
  }
  .links-editor {
    display: grid;
    gap: 0.65rem;
  }
  .links-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .links-heading > span,
  .links-heading button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.78rem;
    font-weight: 750;
  }
  .links-heading > span {
    color: var(--text-secondary);
  }
  .links-heading button {
    border: 0;
    border-radius: 0.5rem;
    padding: 0.45rem 0.6rem;
    background: var(--surface-selected);
    color: var(--green-800);
  }
  .link-row {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.4fr) auto;
    align-items: end;
    gap: 0.55rem;
    border: 1px solid var(--line);
    border-radius: 0.7rem;
    padding: 0.7rem;
    background: var(--surface-muted);
  }
  .remove-link {
    width: 2.5rem;
    height: 2.5rem;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 0.55rem;
    background: var(--danger-bg);
    color: var(--danger-text);
  }
  .links-empty {
    margin: 0;
    color: var(--ink-muted);
    font-size: 0.76rem;
  }
  .check {
    display: flex;
    grid-auto-flow: column;
    justify-content: start;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
  }
  .check input {
    width: auto;
  }
  .states {
    display: flex;
    gap: 1rem;
  }
  footer {
    flex: 0 0 auto;
    display: flex;
    gap: 0.5rem;
    padding: 0.8rem 1rem;
    border-top: 1px solid var(--line);
    background: var(--cream);
    box-shadow: 0 -6px 18px var(--shadow-soft);
  }
  footer button,
  .search-box button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    border: 0;
    border-radius: 0.6rem;
    padding: 0.65rem 0.85rem;
    font-size: 0.8rem;
    font-weight: 750;
  }
  footer .primary {
    flex: 1;
  }
  .primary,
  .search-box button {
    background: var(--accent-bg);
    color: var(--accent-text);
  }
  .secondary {
    background: var(--surface-muted);
    color: var(--text-secondary);
  }
  .search-box {
    display: flex;
    gap: 0.4rem;
  }
  .search-box button {
    white-space: nowrap;
  }
  .search-box button:disabled {
    opacity: 0.55;
    cursor: default;
  }
  .geocode-results {
    display: grid;
    border: 1px solid var(--line);
    border-radius: 0.6rem;
    overflow: hidden;
    margin-top: 0.35rem;
  }
  .geocode-results button {
    border: 0;
    border-bottom: 1px solid var(--line);
    background: var(--surface-raised);
    color: var(--text);
    padding: 0.65rem;
    text-align: left;
    font-size: 0.78rem;
  }
  .geocode-results button:hover {
    background: var(--surface-selected);
  }
  .geocode-results small {
    padding: 0.45rem 0.65rem;
    color: var(--ink-muted);
  }
  .field-error {
    margin: 0.3rem 0 0;
    color: var(--danger);
    font-size: 0.78rem;
  }
  :global(.spin) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (max-width: 580px) {
    .link-row {
      grid-template-columns: 1fr auto;
    }
    .link-row label:first-child {
      grid-column: 1 / -1;
    }
  }
</style>
