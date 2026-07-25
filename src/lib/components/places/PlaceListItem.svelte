<script lang="ts">
  import { Archive, Camera, Heart, Star } from '@lucide/svelte';
  import type { PlaceSummary } from '$lib/types';

  let {
    place,
    selected,
    onselect
  }: { place: PlaceSummary; selected: boolean; onselect: () => void } = $props();
</script>

<button class:selected class="place-row" type="button" onclick={onselect}>
  <span class="category-dot" style:background={place.category.color}>
    {@html place.category.iconSvg}
  </span>
  <span class="copy">
    <strong>{place.name}</strong>
    <span>{place.address || place.category.name}</span>
    <span class="meta">
      <span class="status">{place.status.replaceAll('_', ' ')}</span>
      {#if place.rating}<span><Star size={12} fill="currentColor" /> {place.rating}</span>{/if}
      {#if place.isFavorite}<Heart size={13} fill="currentColor" aria-label="Favorite" />{/if}
      {#if place.isArchived}<Archive size={13} aria-label="Archived" />{/if}
      {#if place.attachmentCount}<span><Camera size={13} /> {place.attachmentCount}</span>{/if}
    </span>
  </span>
</button>

<style>
  .place-row {
    width: 100%;
    display: flex;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
    text-align: left;
    border: 0;
    border-bottom: 1px solid var(--line);
    background: transparent;
    color: inherit;
  }
  .place-row:hover,
  .place-row.selected {
    background: #e8f1e9;
  }
  .category-dot {
    width: 2.2rem;
    height: 2.2rem;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    border-radius: 0.75rem;
    color: white;
  }
  .category-dot :global(svg) {
    width: 1.1rem;
    height: 1.1rem;
  }
  .copy {
    min-width: 0;
    display: grid;
    gap: 0.2rem;
  }
  strong {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .copy > span {
    color: var(--ink-muted);
    font-size: 0.78rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }
  .meta > span {
    display: inline-flex;
    align-items: center;
    gap: 0.18rem;
  }
  .status {
    text-transform: capitalize;
    color: var(--green-800) !important;
    font-weight: 700;
  }
</style>
