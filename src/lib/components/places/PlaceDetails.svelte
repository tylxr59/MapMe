<script lang="ts">
  import {
    Archive,
    CalendarDays,
    Camera,
    Check,
    Copy,
    Download,
    Edit3,
    ExternalLink,
    Heart,
    ImagePlus,
    LocateFixed,
    MapPin,
    Navigation,
    Star,
    Trash2,
    X
  } from '@lucide/svelte';
  import { onDestroy } from 'svelte';
  import type { PlaceDetail } from '$lib/types';

  let {
    place,
    onedit,
    onclose,
    ondeleted,
    onchanged
  }: {
    place: PlaceDetail;
    onedit: () => void;
    onclose: () => void;
    ondeleted: () => void;
    onchanged: () => void;
  } = $props();

  let deleting = $state(false);
  let uploadInput: HTMLInputElement;
  let photoMessage = $state('');
  let uploading = $state(false);
  let copiedCoordinates = $state<string | null>(null);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  const coordinateText = $derived(`${place.latitude.toFixed(6)}, ${place.longitude.toFixed(6)}`);

  onDestroy(() => clearTimeout(copyTimer));

  function copyWithSelection(value: string) {
    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();

    try {
      if (!document.execCommand('copy')) throw new Error('Copy was not accepted');
    } finally {
      input.remove();
    }
  }

  async function copyCoords() {
    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(coordinateText);
        } catch {
          copyWithSelection(coordinateText);
        }
      } else {
        copyWithSelection(coordinateText);
      }

      copiedCoordinates = coordinateText;
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copiedCoordinates = null), 2000);
    } catch {
      copiedCoordinates = null;
    }
  }

  async function deletePlace() {
    if (!deleting) {
      deleting = true;
      return;
    }
    const body = new FormData();
    body.set('id', place.id);
    const response = await fetch('?/deletePlace', { method: 'POST', body });
    if (response.ok) ondeleted();
  }

  async function uploadPhoto(event: Event) {
    const files = (event.currentTarget as HTMLInputElement).files;
    if (!files?.length) return;
    uploading = true;
    photoMessage = '';
    try {
      for (const file of files) {
        const body = new FormData();
        body.set('photo', file);
        const response = await fetch(`/api/places/${place.id}/attachments`, {
          method: 'POST',
          body
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Photo upload failed');
      }
      onchanged();
    } catch (error) {
      photoMessage = error instanceof Error ? error.message : 'Photo upload failed';
    } finally {
      uploading = false;
      uploadInput.value = '';
    }
  }

  async function removePhoto(id: string) {
    const response = await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
    if (response.ok) onchanged();
    else photoMessage = 'Could not remove the photo.';
  }

  function sendToMaps() {
    const coordinates = `${place.latitude},${place.longitude}`;
    const isAppleDevice = /Macintosh|iPhone|iPad|iPod/.test(navigator.userAgent);

    window.location.href = isAppleDevice
      ? `https://maps.apple.com/?daddr=${encodeURIComponent(coordinates)}`
      : `geo:0,0?q=${encodeURIComponent(`${coordinates} (${place.name})`)}`;
  }
</script>

<article class="details">
  <header class="hero">
    <div class="heading">
      <span class="category" style:background={place.category.color}
        >{@html place.category.iconSvg}</span
      >
      <div class="title">
        <span>{place.category.name}</span>
        <h2 title={place.name}>{place.name}</h2>
      </div>
    </div>
    <button type="button" onclick={onclose} class="icon-button" aria-label="Close details"
      ><X /></button
    >
    <div class="badges">
      <span>{place.status.replaceAll('_', ' ')}</span>
      {#if place.isFavorite}<span><Heart size={14} fill="currentColor" /> Favorite</span>{/if}
      {#if place.isArchived}<span><Archive size={14} /> Archived</span>{/if}
      {#if place.rating}<span><Star size={14} fill="currentColor" /> {place.rating}/5</span>{/if}
      {#if place.dateVisited}<span><CalendarDays size={14} /> {place.dateVisited}</span>{/if}
    </div>
  </header>

  <div class="body">
    <section class="card location-card">
      <div class="section-heading">
        <span class="section-icon"><MapPin size={16} /></span>
        <h3>Location</h3>
      </div>
      {#if place.address}<p class="address">{place.address}</p>{/if}
      <div class="coordinate-row">
        <LocateFixed size={15} aria-hidden="true" />
        <span class="coordinate-value">{coordinateText}</span>
        <button type="button" class="copy-coordinates" onclick={copyCoords}>
          {#if copiedCoordinates === coordinateText}
            <Check size={14} /> Copied
          {:else}
            <Copy size={14} /> Copy coords
          {/if}
        </button>
      </div>
      <div class="location-actions">
        <button type="button" class="maps" onclick={sendToMaps}>
          <Navigation size={15} /> Directions
        </button>
        {#if place.sourceUrl}
          <a href={place.sourceUrl} target="_blank" rel="noreferrer noopener"
            ><ExternalLink size={15} /> Source link</a
          >
        {/if}
      </div>
    </section>

    {#if place.description}<section class="card">
        <div class="section-heading"><h3>Notes</h3></div>
        <p class="notes">{place.description}</p>
      </section>{/if}

    <section class="card photo-card">
      <div class="section-heading photo-heading">
        <div>
          <span class="section-icon"><Camera size={16} /></span>
          <h3>Photos</h3>
        </div>
        <input
          bind:this={uploadInput}
          class="sr-only"
          id="photo-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onchange={uploadPhoto}
        />
        <button
          type="button"
          class="add-photos"
          onclick={() => uploadInput.click()}
          disabled={uploading}
          ><ImagePlus size={15} /> {uploading ? 'Uploading…' : 'Add photos'}</button
        >
      </div>
      {#if photoMessage}<p class="photo-error" role="alert">{photoMessage}</p>{/if}
      {#if place.attachments.length}
        <div class="photos">
          {#each place.attachments as photo}
            <figure>
              <img src={photo.thumbnailUrl} alt={photo.originalName} />
              <figcaption>
                <a href={photo.originalUrl} aria-label={`Download ${photo.originalName}`}
                  ><Download size={14} /></a
                >
                <button
                  type="button"
                  onclick={() => removePhoto(photo.id)}
                  aria-label={`Delete ${photo.originalName}`}><Trash2 size={14} /></button
                >
              </figcaption>
            </figure>
          {/each}
        </div>
      {:else}<div class="photo-empty">
          <ImagePlus size={20} /> Add a photo to remember this place
        </div>{/if}
    </section>

    <div class="timestamps">
      <span>Added {new Date(place.createdAt).toLocaleDateString()}</span>
      <span>Updated {new Date(place.updatedAt).toLocaleDateString()}</span>
    </div>
  </div>

  <footer>
    <button type="button" class:confirm={deleting} onclick={deletePlace}
      ><Trash2 size={16} /> {deleting ? 'Confirm delete' : 'Delete'}</button
    >
    <button type="button" class="edit" onclick={onedit}><Edit3 size={16} /> Edit place</button>
  </footer>
</article>

<style>
  .details {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--paper);
  }

  .hero {
    position: relative;
    display: grid;
    gap: 0.9rem;
    padding: 1.15rem 3.75rem 1rem 1.15rem;
    border-bottom: 1px solid var(--line);
    background: var(--cream);
  }
  .heading {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }
  .category {
    width: 3rem;
    height: 3rem;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    border: 2px solid color-mix(in srgb, white 70%, transparent);
    border-radius: 1rem;
    color: white;
    box-shadow: 0 5px 14px color-mix(in srgb, var(--shadow-panel) 70%, transparent);
  }
  .category :global(svg) {
    width: 1.35rem;
    height: 1.35rem;
  }
  .title {
    min-width: 0;
    flex: 1;
  }
  .title span {
    color: var(--green-700);
    font-size: 0.68rem;
    font-weight: 850;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }
  h2 {
    display: -webkit-box;
    overflow: hidden;
    margin: 0.18rem 0 0;
    font-size: 1.24rem;
    line-height: 1.22;
    text-overflow: ellipsis;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
  .icon-button {
    position: absolute;
    top: 1rem;
    right: 1rem;
    display: grid;
    width: 2.2rem;
    height: 2.2rem;
    place-items: center;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--ink-muted);
  }
  .icon-button:hover {
    background: var(--surface-muted);
    color: var(--text);
  }
  .icon-button :global(svg) {
    width: 1.2rem;
    height: 1.2rem;
  }

  .body {
    flex: 1;
    overflow: auto;
    display: grid;
    align-content: start;
    gap: 0.75rem;
    padding: 0.85rem;
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .badges span {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border-radius: 999px;
    background: var(--badge-bg);
    color: var(--badge-text);
    padding: 0.32rem 0.58rem;
    font-size: 0.7rem;
    font-weight: 750;
    text-transform: capitalize;
  }

  .card {
    display: grid;
    gap: 0.75rem;
    padding: 0.9rem;
    border: 1px solid var(--line);
    border-radius: 0.9rem;
    background: var(--cream);
    box-shadow: 0 1px 2px var(--shadow-soft);
  }
  .section-heading {
    display: flex;
    min-height: 1.5rem;
    align-items: center;
    gap: 0.45rem;
  }
  .section-icon {
    display: grid;
    width: 1.65rem;
    height: 1.65rem;
    place-items: center;
    border-radius: 0.48rem;
    background: var(--surface-selected);
    color: var(--green-700);
  }
  h3 {
    margin: 0;
    color: var(--text);
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.055em;
    text-transform: uppercase;
  }

  .address {
    margin: -0.1rem 0 0;
    color: var(--text-secondary);
    font-size: 0.88rem;
    line-height: 1.45;
  }
  .coordinate-row {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    min-height: 2.45rem;
    padding: 0.35rem 0.4rem 0.35rem 0.65rem;
    border: 1px solid var(--line);
    border-radius: 0.65rem;
    background: var(--surface-muted);
    color: var(--text-secondary);
  }
  .coordinate-row > :global(svg) {
    flex: 0 0 auto;
    color: var(--green-700);
  }
  .coordinate-value {
    min-width: 0;
    flex: 1;
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
    font-size: 0.76rem;
    font-variant-numeric: tabular-nums;
  }
  .copy-coordinates {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    border: 0;
    border-radius: 0.48rem;
    background: var(--cream);
    color: var(--green-800);
    padding: 0.42rem 0.58rem;
    box-shadow: 0 1px 2px var(--shadow-soft);
    font-size: 0.7rem;
    font-weight: 750;
    white-space: nowrap;
  }
  .copy-coordinates:hover {
    background: var(--surface-selected);
  }
  .copy-coordinates:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .location-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }
  .location-actions button,
  .location-actions a,
  .add-photos {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    min-height: 2rem;
    border: 0;
    border-radius: 0.55rem;
    background: var(--surface-muted);
    color: var(--green-800);
    padding: 0.45rem 0.65rem;
    font-size: 0.74rem;
    font-weight: 750;
    text-decoration: none;
  }
  .location-actions .maps {
    background: var(--accent-bg);
    color: var(--accent-text);
  }

  .notes {
    margin: 0;
    color: var(--text-secondary);
    white-space: pre-wrap;
    line-height: 1.55;
    font-size: 0.9rem;
  }

  .photo-heading {
    justify-content: space-between;
  }
  .photo-heading > div {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }
  .add-photos {
    min-height: 1.9rem;
    padding: 0.4rem 0.58rem;
  }
  .photos {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }
  .photos img {
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    border-radius: 0.6rem;
  }
  figure {
    position: relative;
    margin: 0;
  }
  figcaption {
    position: absolute;
    right: 0.25rem;
    bottom: 0.4rem;
    display: flex;
    gap: 0.2rem;
  }
  figcaption a,
  figcaption button {
    display: grid;
    place-items: center;
    width: 1.8rem;
    height: 1.8rem;
    border: 0;
    border-radius: 0.45rem;
    background: #152b20dd;
    color: white;
  }
  .photo-error {
    margin: 0;
    color: var(--danger);
    font-size: 0.75rem;
  }
  .photo-empty {
    display: flex;
    min-height: 4.5rem;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border: 1px dashed var(--input-border);
    border-radius: 0.7rem;
    background: var(--surface-muted);
    color: var(--ink-muted);
    padding: 0.8rem;
    font-size: 0.78rem;
    text-align: center;
  }

  .timestamps {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.35rem 1rem;
    padding: 0.15rem 0.15rem 0.3rem;
    color: var(--ink-muted);
    font-size: 0.7rem;
  }

  footer {
    display: flex;
    gap: 0.5rem;
    padding: 0.8rem 1rem;
    border-top: 1px solid var(--line);
    background: var(--cream);
    box-shadow: 0 -6px 18px var(--shadow-soft);
  }
  footer button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    border: 0;
    border-radius: 0.6rem;
    padding: 0.65rem 0.8rem;
    font-size: 0.8rem;
    font-weight: 750;
    color: var(--text-secondary);
    background: var(--surface-muted);
  }
  footer .edit {
    flex: 1;
    background: var(--accent-bg);
    color: var(--accent-text);
  }
  footer .confirm {
    background: var(--danger);
    color: var(--accent-text);
  }

  @media (max-width: 430px) {
    .hero {
      padding-left: 1rem;
    }
    .body {
      padding: 0.75rem;
    }
    .coordinate-row {
      flex-wrap: wrap;
    }
    .copy-coordinates {
      margin-left: auto;
    }
  }
</style>
