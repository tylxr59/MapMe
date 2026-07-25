<script lang="ts">
  import {
    Archive,
    CalendarDays,
    Camera,
    Download,
    Edit3,
    ExternalLink,
    Heart,
    ImagePlus,
    MapPin,
    Navigation,
    Star,
    Trash2,
    X
  } from '@lucide/svelte';
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
  <header>
    <span class="category" style:background={place.category.color}
      >{@html place.category.iconSvg}</span
    >
    <div class="title">
      <span>{place.category.name}</span>
      <h2>{place.name}</h2>
    </div>
    <button type="button" onclick={onclose} class="icon-button" aria-label="Close details"
      ><X /></button
    >
  </header>
  <div class="body">
    <div class="badges">
      <span>{place.status.replaceAll('_', ' ')}</span>
      {#if place.isFavorite}<span><Heart size={14} fill="currentColor" /> Favorite</span>{/if}
      {#if place.isArchived}<span><Archive size={14} /> Archived</span>{/if}
      {#if place.rating}<span><Star size={14} fill="currentColor" /> {place.rating}/5</span>{/if}
    </div>
    <section class="facts">
      <div>
        <MapPin size={17} /><span
          >{place.address || `${place.latitude.toFixed(6)}, ${place.longitude.toFixed(6)}`}</span
        >
      </div>
      {#if place.dateVisited}<div>
          <CalendarDays size={17} /><span>Visited {place.dateVisited}</span>
        </div>{/if}
      {#if place.sourceUrl}<div>
          <ExternalLink size={17} /><a
            href={place.sourceUrl}
            target="_blank"
            rel="noreferrer noopener">Open source link</a
          >
        </div>{/if}
    </section>
    {#if place.description}<section>
        <h3>Notes</h3>
        <p class="notes">{place.description}</p>
      </section>{/if}
    {#if place.tags.length}
      <section>
        <h3>Tags</h3>
        <div class="tags">
          {#each place.tags as tag}<span>{tag.name}</span>{/each}
        </div>
      </section>
    {/if}
    <section>
      <h3>Photos</h3>
      <div class="photo-actions">
        <input
          bind:this={uploadInput}
          class="sr-only"
          id="photo-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onchange={uploadPhoto}
        />
        <button type="button" onclick={() => uploadInput.click()} disabled={uploading}
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
      {:else}<div class="photo-empty"><Camera size={20} /> No photos yet</div>{/if}
    </section>
    <small
      >Saved {new Date(place.createdAt).toLocaleDateString()} · Updated {new Date(
        place.updatedAt
      ).toLocaleDateString()}</small
    >
  </div>
  <footer>
    <button type="button" class:confirm={deleting} onclick={deletePlace}
      ><Trash2 size={16} /> {deleting ? 'Confirm delete' : 'Delete'}</button
    >
    <button type="button" class="maps" onclick={sendToMaps}
      ><Navigation size={16} /> Send to Maps</button
    >
    <button type="button" class="edit" onclick={onedit}><Edit3 size={16} /> Edit place</button>
  </footer>
</article>

<style>
  .details {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--cream);
  }
  header {
    display: flex;
    gap: 0.8rem;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--line);
  }
  .category {
    width: 2.6rem;
    height: 2.6rem;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    border-radius: 0.8rem;
    color: white;
  }
  .category :global(svg) {
    width: 1.25rem;
    height: 1.25rem;
  }
  .title {
    min-width: 0;
    flex: 1;
  }
  .title span {
    color: var(--green-700);
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
  }
  h2 {
    margin: 0.1rem 0 0;
    font-size: 1.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .icon-button {
    border: 0;
    background: transparent;
    color: var(--ink-muted);
  }
  .body {
    flex: 1;
    overflow: auto;
    display: grid;
    align-content: start;
    gap: 1.15rem;
    padding: 1rem;
  }
  .badges,
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .badges span,
  .tags span {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border-radius: 999px;
    background: var(--badge-bg);
    color: var(--badge-text);
    padding: 0.35rem 0.55rem;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: capitalize;
  }
  .facts {
    display: grid;
    gap: 0.65rem;
  }
  .facts div {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    color: var(--text-secondary);
    font-size: 0.85rem;
    line-height: 1.4;
  }
  .facts :global(svg) {
    flex: 0 0 auto;
    margin-top: 0.05rem;
    color: var(--green-700);
  }
  h3 {
    margin: 0 0 0.5rem;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ink-muted);
  }
  .notes {
    margin: 0;
    white-space: pre-wrap;
    line-height: 1.55;
    font-size: 0.9rem;
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
  .photo-actions button {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    border: 0;
    border-radius: 0.5rem;
    background: var(--surface-muted);
    color: var(--green-800);
    padding: 0.5rem 0.65rem;
    font-size: 0.75rem;
    font-weight: 750;
  }
  .photo-error {
    color: var(--danger);
    font-size: 0.75rem;
  }
  .photo-empty {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--ink-muted);
    font-size: 0.82rem;
  }
  small {
    color: var(--ink-muted);
  }
  footer {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.8rem 1rem;
    border-top: 1px solid var(--line);
  }
  footer button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: 0;
    border-radius: 0.6rem;
    padding: 0.65rem 0.8rem;
    font-weight: 750;
    color: var(--text-secondary);
    background: var(--surface-muted);
  }
  footer .edit {
    background: var(--accent-bg);
    color: var(--accent-text);
  }
  footer .maps {
    margin-left: auto;
  }
  footer .confirm {
    background: var(--danger);
    color: var(--accent-text);
  }
</style>
