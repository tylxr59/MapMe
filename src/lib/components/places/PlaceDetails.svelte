<script lang="ts">
  import {
    Archive,
    CalendarDays,
    Camera,
    Check,
    Copy,
    Download,
    ExternalLink,
    Heart,
    ImagePlus,
    Link2,
    MapPin,
    Navigation,
    NotebookPen,
    PenLine,
    Star,
    Trash2,
    X
  } from '@lucide/svelte';
  import { onDestroy } from 'svelte';
  import type { PlaceDetail } from '#lib/types/index.js';

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
    onchanged: () => void | Promise<void>;
  } = $props();

  let deleting = $state(false);
  let favoriteBusy = $state(false);
  let uploadInput: HTMLInputElement;
  let photoMessage = $state('');
  let uploading = $state(false);
  let copiedCoordinates = $state<string | null>(null);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  const coordinateText = $derived(`${place.latitude.toFixed(6)}, ${place.longitude.toFixed(6)}`);
  const cover = $derived(place.attachments[0] ?? null);
  const dateFormat = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const visited = $derived(
    place.dateVisited ? dateFormat.format(new Date(`${place.dateVisited}T12:00:00`)) : null
  );

  function hostname(url: string) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

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

  async function toggleFavorite() {
    if (favoriteBusy) return;
    favoriteBusy = true;
    try {
      const body = new FormData();
      body.set('id', place.id);
      body.set('isFavorite', String(!place.isFavorite));
      const response = await fetch('?/favoritePlace', { method: 'POST', body });
      if (response.ok) await onchanged();
    } finally {
      favoriteBusy = false;
    }
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

<article class="details" style:--category={place.category.color}>
  <header class="hero" class:has-cover={Boolean(cover)}>
    <div class="hero-art">
      {#if cover}
        <img class="cover" src={cover.thumbnailUrl} alt="" />
      {:else}
        <svg
          class="contours"
          viewBox="0 0 440 160"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <g fill="none" stroke="currentColor" stroke-width="1.1">
            <path d="M-20 120c60-30 110-10 160-30s90-70 160-60 110 40 160 20" />
            <path d="M-20 140c70-24 120-4 170-22s100-60 160-50 100 40 150 22" />
            <path d="M-20 100c50-34 100-20 150-40s80-70 150-62 120 34 180 14" />
            <path d="M-20 80c40-30 90-30 130-46s80-52 140-48 120 26 210 8" />
            <path d="M-20 160c80-18 130 0 180-14s110-44 170-38 90 30 130 20" />
            <path d="M-20 60c40-24 80-34 120-44s70-40 130-38 130 18 230 2" />
            <ellipse cx="330" cy="58" rx="40" ry="18" />
            <ellipse cx="330" cy="58" rx="22" ry="9" />
          </g>
        </svg>
      {/if}
    </div>
    <span class="category-badge">{@html place.category.iconSvg}</span>
    <button type="button" onclick={onclose} class="close" aria-label="Close details"
      ><X size={18} /></button
    >
  </header>

  <div class="body">
    <div class="title-block">
      <span class="eyebrow"
        >{place.category.name} <span aria-hidden="true">·</span> {place.list.name}</span
      >
      <h2 title={place.name}>{place.name}</h2>
      <div class="facts">
        {#if place.rating}
          <span class="stars" aria-label={`${place.rating} out of 5 stars`}>
            {#each [1, 2, 3, 4, 5] as value (value)}
              <Star
                size={14}
                fill={value <= place.rating ? 'currentColor' : 'none'}
                class={value <= place.rating ? 'on' : 'off'}
              />
            {/each}
          </span>
        {/if}
        {#if visited}<span><CalendarDays size={14} /> Visited {visited}</span>{/if}
        {#if place.isArchived}<span class="archived"><Archive size={14} /> Archived</span>{/if}
      </div>
    </div>

    <div class="actions">
      <button type="button" class="action primary" onclick={sendToMaps}>
        <span class="action-icon"><Navigation size={18} /></span>
        <span>Directions</span>
      </button>
      <button
        type="button"
        class="action favorite"
        class:active={place.isFavorite}
        aria-pressed={place.isFavorite}
        aria-label={place.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        onclick={toggleFavorite}
        disabled={favoriteBusy}
      >
        <span class="action-icon"
          ><Heart size={18} fill={place.isFavorite ? 'currentColor' : 'none'} /></span
        >
        <span>{place.isFavorite ? 'Favorited' : 'Favorite'}</span>
      </button>
      <button type="button" class="action" onclick={copyCoords}>
        <span class="action-icon">
          {#if copiedCoordinates === coordinateText}<Check size={18} />{:else}<Copy
              size={18}
            />{/if}
        </span>
        <span>{copiedCoordinates === coordinateText ? 'Copied' : 'Copy coords'}</span>
      </button>
      <button type="button" class="action" onclick={onedit} aria-label="Edit place">
        <span class="action-icon"><PenLine size={18} /></span>
        <span>Edit</span>
      </button>
    </div>

    <section class="section">
      <h3><MapPin size={14} /> Location</h3>
      <div class="location">
        {#if place.address}<p class="address">{place.address}</p>{/if}
        <p class="coordinates">{coordinateText}</p>
      </div>
    </section>

    {#if place.description}
      <section class="section">
        <h3><NotebookPen size={14} /> Notes</h3>
        <p class="notes">{place.description}</p>
      </section>
    {/if}

    {#if place.links.length}
      <section class="section">
        <h3><Link2 size={14} /> Links</h3>
        <div class="link-list">
          {#each place.links as link (link.id)}
            <a href={link.url} target="_blank" rel="noreferrer noopener">
              <span class="favicon">{hostname(link.url).charAt(0).toUpperCase()}</span>
              <span class="link-copy">
                <strong>{link.title || hostname(link.url)}</strong>
                <small>{hostname(link.url)}</small>
              </span>
              <ExternalLink size={15} />
            </a>
          {/each}
        </div>
      </section>
    {/if}

    <section class="section">
      <div class="section-row">
        <h3><Camera size={14} /> Photos</h3>
        {#if place.attachments.length}<span class="muted">{place.attachments.length}</span>{/if}
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
      {#if photoMessage}<p class="photo-error" role="alert">{photoMessage}</p>{/if}
      <div class="photos">
        {#each place.attachments as photo (photo.id)}
          <figure>
            <img src={photo.thumbnailUrl} alt={photo.originalName} loading="lazy" />
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
        <button
          type="button"
          class="add-photo"
          class:solo={!place.attachments.length}
          onclick={() => uploadInput.click()}
          disabled={uploading}
        >
          <ImagePlus size={20} />
          <span
            >{uploading
              ? 'Uploading…'
              : place.attachments.length
                ? 'Add photos'
                : 'Add a photo to remember this place'}</span
          >
        </button>
      </div>
    </section>

    <footer>
      <div class="timestamps">
        <span>Added {new Date(place.createdAt).toLocaleDateString()}</span>
        <span>Updated {new Date(place.updatedAt).toLocaleDateString()}</span>
      </div>
      <div class="danger-zone">
        {#if deleting}
          <button type="button" class="ghost" onclick={() => (deleting = false)}>Cancel</button>
        {/if}
        <button type="button" class="delete" class:confirm={deleting} onclick={deletePlace}
          ><Trash2 size={15} /> {deleting ? 'Confirm delete' : 'Delete'}</button
        >
      </div>
    </footer>
  </div>
</article>

<style>
  .details {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--cream);
    overflow: hidden;
  }

  /* Hero ------------------------------------------------------------------------------- */
  .hero {
    position: relative;
    flex: 0 0 auto;
    height: 8.5rem;
    background:
      radial-gradient(
        120% 140% at 85% 20%,
        color-mix(in srgb, var(--category) 55%, transparent),
        transparent 60%
      ),
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--category) 30%, var(--cream)),
        color-mix(in srgb, var(--category) 70%, #1a140a)
      );
    color: color-mix(in srgb, white 45%, transparent);
  }
  .hero.has-cover {
    height: 12rem;
    background: var(--surface-sunken);
  }
  .hero-art {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  .hero.has-cover .hero-art::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, #0000 40%, #00000059);
  }
  .cover {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }
  .contours {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .category-badge {
    position: absolute;
    z-index: 1;
    left: 1.25rem;
    bottom: -1.4rem;
    width: 3.4rem;
    height: 3.4rem;
    display: grid;
    place-items: center;
    border: 3px solid var(--cream);
    border-radius: 1.05rem;
    background: var(--category);
    color: white;
    box-shadow: 0 8px 20px -6px color-mix(in srgb, var(--category) 70%, #000);
    transform: rotate(-4deg);
  }
  .category-badge :global(svg) {
    width: 1.5rem;
    height: 1.5rem;
  }
  .close {
    position: absolute;
    z-index: 2;
    top: 0.85rem;
    right: 0.85rem;
    width: 2.2rem;
    height: 2.2rem;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    background: #0000004d;
    backdrop-filter: blur(8px);
    color: white;
    transition: background 120ms ease;
  }
  .close:hover {
    background: #00000080;
  }

  /* Body ------------------------------------------------------------------------------- */
  .body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: grid;
    align-content: start;
    gap: 1.35rem;
    padding: 0 1.25rem 1.25rem;
  }
  .hero.has-cover + .body .title-block,
  .title-block {
    padding-top: 2.1rem;
  }
  .eyebrow {
    color: color-mix(in srgb, var(--category) 70%, var(--text));
    font-size: 0.7rem;
    font-weight: 650;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  h2 {
    display: -webkit-box;
    overflow: hidden;
    margin: 0.3rem 0 0;
    font-family: var(--font-display);
    font-size: 1.85rem;
    font-weight: 560;
    font-variation-settings: 'opsz' 96;
    letter-spacing: -0.012em;
    line-height: 1.08;
    text-wrap: balance;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }
  .facts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.9rem;
    margin-top: 0.6rem;
    color: var(--text-secondary);
    font-size: 0.82rem;
  }
  .facts > span {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .stars {
    gap: 0.1rem !important;
  }
  .stars :global(.on) {
    color: var(--marigold);
  }
  .stars :global(.off) {
    color: var(--line-strong);
  }
  .archived {
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    background: var(--badge-bg);
  }

  /* Action row -------------------------------------------------------------------------- */
  .actions {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
    padding-bottom: 1.35rem;
    border-bottom: 1px solid var(--line);
  }
  .action {
    display: grid;
    justify-items: center;
    gap: 0.4rem;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.74rem;
    font-weight: 600;
  }
  .action-icon {
    width: 2.9rem;
    height: 2.9rem;
    display: grid;
    place-items: center;
    border: 1px solid var(--line-strong);
    border-radius: 50%;
    background: var(--surface-raised);
    color: var(--text);
    transition:
      transform 200ms var(--ease-spring),
      background 120ms ease,
      border-color 120ms ease;
  }
  .action:hover .action-icon {
    transform: translateY(-2px);
    border-color: var(--ink-muted);
  }
  .action:active .action-icon {
    transform: scale(0.94);
  }
  .action.primary {
    color: var(--brand-text);
  }
  .action.primary .action-icon {
    border-color: var(--brand);
    background: var(--brand);
    color: var(--accent-text);
    box-shadow: 0 8px 18px -8px var(--brand);
  }
  .action.favorite.active {
    color: color-mix(in srgb, var(--marigold) 75%, var(--text));
  }
  .action.favorite.active .action-icon {
    border-color: var(--marigold);
    background: var(--marigold-soft);
    color: var(--marigold);
    animation: pop 360ms var(--ease-spring);
  }
  .action:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  /* Sections ---------------------------------------------------------------------------- */
  .section {
    display: grid;
    gap: 0.6rem;
  }
  .section-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
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
  .muted {
    color: var(--ink-muted);
    font-size: 0.75rem;
  }
  .location {
    display: grid;
    gap: 0.35rem;
    padding: 0.85rem 0.95rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface-raised);
  }
  .address {
    margin: 0;
    color: var(--text);
    font-size: 0.92rem;
    line-height: 1.45;
  }
  .coordinates {
    margin: 0;
    color: var(--ink-muted);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
  }
  .notes {
    margin: 0;
    padding: 0.1rem 0 0.1rem 1rem;
    border-left: 3px solid color-mix(in srgb, var(--category) 60%, var(--line));
    color: var(--text);
    font-family: var(--font-display);
    font-size: 1.04rem;
    font-variation-settings: 'opsz' 18;
    line-height: 1.55;
    white-space: pre-wrap;
  }
  .link-list {
    display: grid;
    gap: 0.4rem;
  }
  .link-list a {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.55rem 0.8rem 0.55rem 0.55rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface-raised);
    color: var(--ink-muted);
    text-decoration: none;
    transition:
      border-color 120ms ease,
      transform 160ms var(--ease-out);
  }
  .link-list a:hover {
    border-color: var(--line-strong);
    transform: translateX(2px);
    color: var(--text);
  }
  .favicon {
    width: 2.1rem;
    height: 2.1rem;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    border-radius: var(--radius-sm);
    background: var(--surface-muted);
    color: var(--text-secondary);
    font-family: var(--font-display);
    font-weight: 600;
  }
  .link-copy {
    min-width: 0;
    flex: 1;
    display: grid;
  }
  .link-copy strong,
  .link-copy small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .link-copy strong {
    color: var(--text);
    font-size: 0.86rem;
    font-weight: 600;
  }
  .link-copy small {
    font-size: 0.72rem;
  }

  .photos {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.4rem;
  }
  figure {
    position: relative;
    margin: 0;
    overflow: hidden;
    border-radius: var(--radius-sm);
  }
  .photos img {
    width: 100%;
    display: block;
    aspect-ratio: 1;
    object-fit: cover;
    transition: transform 300ms var(--ease-out);
  }
  figure:hover img {
    transform: scale(1.04);
  }
  figcaption {
    position: absolute;
    right: 0.3rem;
    bottom: 0.3rem;
    display: flex;
    gap: 0.2rem;
    opacity: 0;
    transition: opacity 150ms ease;
  }
  figure:hover figcaption,
  figure:focus-within figcaption {
    opacity: 1;
  }
  figcaption a,
  figcaption button {
    width: 1.75rem;
    height: 1.75rem;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: var(--radius-xs);
    background: #000000a6;
    backdrop-filter: blur(4px);
    color: white;
  }
  .add-photo {
    aspect-ratio: 1;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 0.35rem;
    padding: 0.5rem;
    border: 1.5px dashed var(--line-strong);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--ink-muted);
    font-size: 0.72rem;
    font-weight: 550;
    text-align: center;
    transition:
      border-color 120ms ease,
      color 120ms ease,
      background 120ms ease;
  }
  .add-photo.solo {
    grid-column: 1 / -1;
    aspect-ratio: auto;
    min-height: 5.5rem;
    grid-auto-flow: column;
    gap: 0.55rem;
  }
  .add-photo:hover {
    border-color: var(--brand-text);
    background: var(--surface-raised);
    color: var(--brand-text);
  }
  .photo-error {
    margin: 0;
    color: var(--danger);
    font-size: 0.78rem;
  }

  footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 0.25rem;
    padding-top: 1rem;
    border-top: 1px solid var(--line);
  }
  .timestamps {
    display: grid;
    color: var(--ink-muted);
    font-size: 0.72rem;
    line-height: 1.5;
  }
  .danger-zone {
    display: flex;
    gap: 0.35rem;
  }
  .danger-zone button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 2.2rem;
    padding: 0.4rem 0.8rem;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    font-size: 0.8rem;
    font-weight: 600;
  }
  .ghost {
    color: var(--text-secondary);
  }
  .ghost:hover {
    background: var(--surface-muted);
  }
  .delete {
    color: var(--danger);
  }
  .delete:hover {
    border-color: color-mix(in srgb, var(--danger) 35%, transparent) !important;
    background: var(--danger-soft) !important;
  }
  .delete.confirm {
    background: var(--danger) !important;
    color: white;
  }

  @keyframes pop {
    40% {
      transform: scale(1.18);
    }
  }

  @media (max-width: 430px) {
    .body {
      padding: 0 1rem 1rem;
    }
    h2 {
      font-size: 1.6rem;
    }
  }
</style>
