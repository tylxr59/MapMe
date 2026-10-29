<script lang="ts">
  import { enhance } from '$app/forms';
  import {
    Check,
    Link2,
    LoaderCircle,
    LocateFixed,
    MapPin,
    Plus,
    Search,
    Star,
    Trash2,
    X
  } from '@lucide/svelte';
  import type {
    CategoryDTO,
    PlaceDetail,
    PlaceListDTO,
    SafeClientConfig
  } from '#lib/types/index.js';

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
  // svelte-ignore state_referenced_locally
  let categoryId = $state(place?.category.id ?? categories.at(-1)?.id ?? '');
  // svelte-ignore state_referenced_locally
  let listId = $state(
    place?.list.id ?? lists.find((list) => list.isSystem)?.id ?? lists.at(-1)?.id ?? ''
  );
  // svelte-ignore state_referenced_locally
  let rating = $state<number>(place?.rating ?? 0);
  let hoverRating = $state(0);
  let saving = $state(false);
  const selectedCategory = $derived(categories.find((category) => category.id === categoryId));
  const ratingLabels = ['Not rated', 'Meh', 'Okay', 'Good', 'Great', 'Unforgettable'];
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

<section
  class="editor"
  aria-label={place ? 'Edit place' : 'Add a place'}
  style:--category={selectedCategory?.color ?? 'var(--vermilion)'}
>
  <header>
    <div>
      <span class="eyebrow">{place ? 'Update your place' : 'Pin something memorable'}</span>
      <h2>{place ? 'Edit place' : 'Add a place'}</h2>
    </div>
    <button type="button" class="icon-button" onclick={onclose} aria-label="Close"
      ><X size={18} /></button
    >
  </header>

  <form
    method="POST"
    action={place ? '?/updatePlace' : '?/createPlace'}
    use:enhance={() => {
      saving = true;
      return async ({ result, update }) => {
        await update();
        saving = false;
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
    <input type="hidden" name="rating" value={rating || ''} />
    <div class="fields">
      <label class="name-field">
        <span class="label">Name</span>
        <input
          name="name"
          required
          maxlength="200"
          value={place?.name ?? ''}
          placeholder="What is this place?"
          autocomplete="off"
        />
      </label>

      <fieldset class="group">
        <legend class="label">Category</legend>
        <div class="category-grid">
          {#each categories as category (category.id)}
            <label class="category-option" style:--option={category.color}>
              <input
                type="radio"
                name="categoryId"
                value={category.id}
                bind:group={categoryId}
                required
              />
              <span class="option-glyph" aria-hidden="true">{@html category.iconSvg}</span>
              <span class="option-name">{category.name}</span>
            </label>
          {/each}
        </div>
      </fieldset>

      <fieldset class="group">
        <legend class="label">List</legend>
        <div class="segmented">
          {#each lists as list (list.id)}
            <label>
              <input type="radio" name="listId" value={list.id} bind:group={listId} required />
              <span>{list.name}</span>
            </label>
          {/each}
        </div>
      </fieldset>

      <section class="block">
        <h3><MapPin size={14} /> Location</h3>
        {#if config.geocodingEnabled}
          <div class="geocoder">
            <div class="search-box">
              <Search size={16} />
              <input
                bind:value={geocodeQuery}
                placeholder="Search an address or point of interest"
                aria-label="Find an address or POI"
                onkeydown={(event) =>
                  event.key === 'Enter' && (event.preventDefault(), searchAddress())}
              />
              <button
                type="button"
                onclick={() => searchAddress()}
                disabled={geocoding || geocodeQuery.trim().length < 3}
              >
                {#if geocoding}<LoaderCircle class="spin" size={15} />{:else}Search{/if}
              </button>
            </div>
            {#if geocodeError}<p class="field-error">{geocodeError}</p>{/if}
            {#if geocodeResults.length}
              <div class="geocode-results">
                {#each geocodeResults as result (`${result.latitude},${result.longitude},${result.displayName}`)}
                  <button type="button" onclick={() => chooseGeocode(result)}
                    ><MapPin size={14} /><span>{result.displayName}</span></button
                  >
                {/each}
                <small>Search data © OpenStreetMap contributors</small>
              </div>
            {/if}
          </div>
        {/if}

        <div class="coordinate-grid">
          <label
            ><span class="label">Latitude</span>
            <input
              class="mono"
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
            ><span class="label">Longitude</span>
            <input
              class="mono"
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
              title="Look up the address at this point"
              aria-label="Look up address for these coordinates"
            >
              {#if geocoding}<LoaderCircle class="spin" size={17} />{:else}<LocateFixed
                  size={17}
                />{/if}
            </button>
          {/if}
        </div>

        <label
          ><span class="label">Address</span>
          <input
            name="address"
            maxlength="500"
            bind:value={address}
            placeholder="Optional — or use the lookup above"
          /></label
        >
      </section>

      <section class="block two-up">
        <div class="rating-field">
          <span class="label" id="rating-label">Rating</span>
          <div
            class="stars"
            role="group"
            aria-labelledby="rating-label"
            onmouseleave={() => (hoverRating = 0)}
          >
            {#each [1, 2, 3, 4, 5] as value (value)}
              <button
                type="button"
                class:lit={(hoverRating || rating) >= value}
                aria-label={`Rate ${value} ${value === 1 ? 'star' : 'stars'}`}
                aria-pressed={rating === value}
                onmouseenter={() => (hoverRating = value)}
                onclick={() => (rating = rating === value ? 0 : value)}
              >
                <Star size={22} fill="currentColor" />
              </button>
            {/each}
          </div>
          <span class="rating-caption">{ratingLabels[hoverRating || rating]}</span>
        </div>
        <label
          ><span class="label">Date visited</span>
          <input name="dateVisited" type="date" value={place?.dateVisited ?? ''} /></label
        >
      </section>

      <label class="block"
        ><span class="label">Notes</span>
        <textarea
          name="description"
          maxlength="20000"
          rows="4"
          placeholder="What do you want to remember?">{place?.description ?? ''}</textarea
        >
      </label>

      <section class="block links-editor">
        <div class="links-heading">
          <h3><Link2 size={14} /> Links</h3>
          <button type="button" class="text-button" onclick={addLink}
            ><Plus size={14} /> Add link</button
          >
        </div>
        {#each links as link, index (link)}
          <div class="link-row">
            <input
              maxlength="200"
              bind:value={link.title}
              placeholder="Label (optional)"
              aria-label={`Link ${index + 1} title`}
            />
            <input
              type="url"
              maxlength="2048"
              bind:value={link.url}
              placeholder="https://…"
              aria-label={`Link ${index + 1} URL`}
            />
            <button
              type="button"
              class="remove-link"
              onclick={() => removeLink(index)}
              aria-label={`Remove link ${index + 1}`}><Trash2 size={15} /></button
            >
          </div>
        {:else}
          <p class="links-empty">Menus, bookings, trail reports — anything worth a click later.</p>
        {/each}
      </section>

      <label class="switch block">
        <input type="checkbox" name="isArchived" checked={place?.isArchived} />
        <span class="track" aria-hidden="true"><span class="thumb"></span></span>
        <span class="switch-copy"><strong>Archived</strong></span>
        <small>Hide from the map unless you filter for it.</small>
      </label>
    </div>
    <footer>
      <button type="button" class="secondary" onclick={onclose}>Cancel</button>
      <button type="submit" class="primary" disabled={saving}>
        {#if saving}<LoaderCircle class="spin" size={17} />{:else}<Check size={17} />{/if}
        {place ? 'Save changes' : 'Save place'}
      </button>
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
    position: relative;
    flex: 0 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: start;
    padding: 1.25rem 1.25rem 1rem;
    border-bottom: 1px solid var(--line);
  }
  header::before {
    content: '';
    position: absolute;
    inset: 0 0 auto;
    height: 4px;
    background: var(--category);
    transition: background 200ms ease;
  }
  .eyebrow {
    color: color-mix(in srgb, var(--category) 75%, var(--text));
    font-size: 0.7rem;
    font-weight: 650;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    transition: color 200ms ease;
  }
  h2 {
    margin: 0.2rem 0 0;
    font-family: var(--font-display);
    font-size: 1.6rem;
    font-weight: 560;
    font-variation-settings: 'opsz' 72;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }
  h3 {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0;
    color: var(--ink-muted);
    font-size: 0.7rem;
    font-weight: 650;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .icon-button {
    width: 2.2rem;
    height: 2.2rem;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--ink-muted);
  }
  .icon-button:hover {
    background: var(--surface-muted);
    color: var(--text);
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
    align-content: start;
    gap: 1.4rem;
    padding: 1.25rem 1.25rem 1.5rem;
  }
  label,
  .block {
    display: grid;
    align-content: start;
    gap: 0.4rem;
  }
  .block {
    gap: 0.75rem;
  }
  .label {
    padding: 0;
    color: var(--text-secondary);
    font-size: 0.78rem;
    font-weight: 600;
  }
  fieldset {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  fieldset legend {
    margin-bottom: 0.45rem;
  }
  input,
  textarea {
    width: 100%;
    min-height: 2.6rem;
    border: 1px solid var(--input-border);
    border-radius: var(--radius-sm);
    padding: 0.55rem 0.75rem;
    background: var(--input-bg);
    color: var(--text);
    outline: 0;
    transition:
      border-color 120ms ease,
      box-shadow 120ms ease;
  }
  input:focus,
  textarea:focus {
    border-color: var(--brand-text);
    box-shadow: 0 0 0 4px var(--focus-ring);
  }
  .mono {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }
  .name-field input {
    min-height: 3.1rem;
    font-family: var(--font-display);
    font-size: 1.3rem;
    font-weight: 500;
    font-variation-settings: 'opsz' 36;
    letter-spacing: -0.01em;
  }
  textarea {
    resize: vertical;
    line-height: 1.5;
  }

  /* Category picker -------------------------------------------------------------------- */
  .category-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.4rem;
  }
  .category-option {
    position: relative;
    display: grid;
    justify-items: center;
    gap: 0.3rem;
    padding: 0.6rem 0.25rem 0.5rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface-raised);
    cursor: pointer;
    transition:
      border-color 120ms ease,
      background 120ms ease,
      transform 200ms var(--ease-spring);
  }
  .category-option:hover {
    border-color: var(--line-strong);
    transform: translateY(-1px);
  }
  .category-option input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .option-glyph {
    width: 2rem;
    height: 2rem;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: color-mix(in srgb, var(--option) 15%, transparent);
    color: var(--option);
    transition:
      background 150ms ease,
      color 150ms ease;
  }
  .option-glyph :global(svg) {
    width: 1rem;
    height: 1rem;
  }
  .option-name {
    max-width: 100%;
    overflow: hidden;
    color: var(--text-secondary);
    font-size: 0.7rem;
    font-weight: 550;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .category-option:has(input:checked) {
    border-color: var(--option);
    background: color-mix(in srgb, var(--option) 8%, var(--surface-raised));
    box-shadow: 0 0 0 1px var(--option);
  }
  .category-option:has(input:checked) .option-glyph {
    background: var(--option);
    color: white;
  }
  .category-option:has(input:checked) .option-name {
    color: var(--text);
  }
  .category-option:has(input:focus-visible) {
    outline: 2px solid var(--brand-text);
    outline-offset: 2px;
  }

  /* List segmented ---------------------------------------------------------------------- */
  .segmented {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    padding: 0.25rem;
    border-radius: var(--radius-md);
    background: var(--surface-muted);
  }
  .segmented label {
    flex: 1 1 auto;
    position: relative;
    display: block;
    cursor: pointer;
  }
  .segmented input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .segmented span {
    display: block;
    padding: 0.45rem 0.7rem;
    border-radius: calc(var(--radius-md) - 0.2rem);
    color: var(--text-secondary);
    font-size: 0.8rem;
    font-weight: 600;
    text-align: center;
    white-space: nowrap;
    transition:
      background 120ms ease,
      color 120ms ease;
  }
  .segmented label:hover span {
    color: var(--text);
  }
  .segmented input:checked + span {
    background: var(--surface-raised);
    color: var(--text);
    box-shadow:
      0 1px 2px var(--shadow-soft),
      0 0 0 1px var(--line);
  }
  .segmented input:focus-visible + span {
    outline: 2px solid var(--brand-text);
    outline-offset: 1px;
  }

  /* Location ----------------------------------------------------------------------------- */
  .search-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.25rem 0.25rem 0.75rem;
    border: 1px solid var(--input-border);
    border-radius: var(--radius-sm);
    background: var(--input-bg);
    color: var(--ink-muted);
  }
  .search-box:focus-within {
    border-color: var(--brand-text);
    box-shadow: 0 0 0 4px var(--focus-ring);
  }
  .search-box input {
    min-height: 2.1rem;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none !important;
  }
  .search-box button {
    min-width: 4.5rem;
    display: grid;
    place-items: center;
    padding: 0.45rem 0.8rem;
    border: 0;
    border-radius: calc(var(--radius-sm) - 0.15rem);
    background: var(--text);
    color: var(--paper);
    font-size: 0.78rem;
    font-weight: 600;
  }
  .search-box button:disabled {
    opacity: 0.35;
  }
  .geocode-results {
    display: grid;
    margin-top: 0.4rem;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-raised);
    box-shadow: var(--shadow-float);
    animation: reveal 200ms var(--ease-out);
  }
  .geocode-results button {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    padding: 0.65rem 0.75rem;
    border: 0;
    border-bottom: 1px solid var(--line);
    background: transparent;
    color: var(--text);
    font-size: 0.8rem;
    line-height: 1.4;
    text-align: left;
  }
  .geocode-results button :global(svg) {
    flex: 0 0 auto;
    margin-top: 0.15rem;
    color: var(--vermilion);
  }
  .geocode-results button:hover {
    background: var(--surface-muted);
  }
  .geocode-results small {
    padding: 0.4rem 0.75rem;
    color: var(--ink-muted);
    font-size: 0.68rem;
  }
  .coordinate-grid {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 0.5rem;
    align-items: end;
  }
  .coordinate-lookup {
    width: 2.6rem;
    height: 2.6rem;
    display: grid;
    place-items: center;
    border: 1px solid var(--input-border);
    border-radius: var(--radius-sm);
    background: var(--input-bg);
    color: var(--vermilion);
    transition: background 120ms ease;
  }
  .coordinate-lookup:hover {
    background: var(--vermilion-soft);
  }
  .coordinate-lookup:disabled {
    opacity: 0.55;
  }
  .field-error {
    margin: 0.35rem 0 0;
    color: var(--danger);
    font-size: 0.78rem;
  }

  /* Rating ------------------------------------------------------------------------------- */
  .two-up {
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  .rating-field {
    display: grid;
    align-content: start;
    gap: 0.4rem;
  }
  .stars {
    display: flex;
    min-height: 2.6rem;
    align-items: center;
  }
  .stars button {
    display: grid;
    place-items: center;
    width: 1.9rem;
    height: 2.2rem;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--line-strong);
    transition:
      color 100ms ease,
      transform 200ms var(--ease-spring);
  }
  .stars button.lit {
    color: var(--marigold);
  }
  .stars button:hover {
    transform: scale(1.18) rotate(-6deg);
  }
  .rating-caption {
    margin-top: -0.35rem;
    color: var(--ink-muted);
    font-size: 0.72rem;
  }

  /* Links -------------------------------------------------------------------------------- */
  .links-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .text-button {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.35rem 0.6rem;
    border: 0;
    border-radius: var(--radius-sm);
    background: var(--surface-muted);
    color: var(--text);
    font-size: 0.76rem;
    font-weight: 600;
  }
  .text-button:hover {
    background: var(--surface-sunken);
  }
  .link-row {
    display: grid;
    grid-template-columns: minmax(0, 0.75fr) minmax(0, 1.25fr) auto;
    gap: 0.4rem;
    animation: reveal 200ms var(--ease-out);
  }
  .remove-link {
    width: 2.6rem;
    height: 2.6rem;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--ink-muted);
  }
  .remove-link:hover {
    background: var(--danger-soft);
    color: var(--danger);
  }
  .links-empty {
    margin: 0;
    color: var(--ink-muted);
    font-size: 0.8rem;
  }

  /* Archive switch ---------------------------------------------------------------------- */
  .switch {
    position: relative;
    grid-template-columns: auto 1fr;
    align-items: center;
    column-gap: 0.75rem;
    row-gap: 0.1rem;
    padding: 0.85rem 0.95rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface-raised);
    cursor: pointer;
  }
  .switch input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
    min-height: 0;
    pointer-events: none;
  }
  .track {
    grid-row: span 2;
    position: relative;
    width: 2.4rem;
    height: 1.4rem;
    border-radius: 999px;
    background: var(--line-strong);
    transition: background 160ms ease;
  }
  .thumb {
    position: absolute;
    top: 0.15rem;
    left: 0.15rem;
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 50%;
    background: white;
    box-shadow: 0 1px 3px #0000004d;
    transition: transform 220ms var(--ease-spring);
  }
  .switch input:checked + .track {
    background: var(--brand);
  }
  .switch input:checked + .track .thumb {
    transform: translateX(1rem);
  }
  .switch input:focus-visible + .track {
    outline: 2px solid var(--brand-text);
    outline-offset: 2px;
  }
  .switch-copy strong {
    font-size: 0.86rem;
    font-weight: 600;
  }
  .switch small {
    color: var(--ink-muted);
    font-size: 0.75rem;
  }

  /* Footer ------------------------------------------------------------------------------- */
  footer {
    flex: 0 0 auto;
    display: flex;
    gap: 0.5rem;
    padding: 0.85rem 1.25rem;
    border-top: 1px solid var(--line);
    background: var(--header-translucent);
    backdrop-filter: blur(10px);
  }
  footer button {
    min-height: 2.85rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border: 0;
    border-radius: var(--radius-md);
    padding: 0.65rem 1.1rem;
    font-size: 0.88rem;
    font-weight: 600;
    transition:
      background 120ms ease,
      transform 160ms var(--ease-spring);
  }
  footer button:active {
    transform: scale(0.98);
  }
  .primary {
    flex: 1;
    background: var(--brand);
    color: var(--accent-text);
    box-shadow:
      inset 0 1px 0 #ffffff26,
      0 8px 18px -10px var(--brand);
  }
  .primary:hover {
    background: var(--brand-hover);
  }
  .primary:disabled {
    opacity: 0.7;
  }
  .secondary {
    background: var(--surface-muted);
    color: var(--text-secondary);
  }
  .secondary:hover {
    background: var(--surface-sunken);
    color: var(--text);
  }
  @keyframes reveal {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
  @media (max-width: 480px) {
    .category-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .link-row {
      grid-template-columns: 1fr auto;
    }
    .link-row input:first-child {
      grid-column: 1 / -1;
    }
    .two-up {
      grid-template-columns: 1fr;
    }
  }
</style>
