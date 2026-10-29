<script lang="ts">
  import { MapPinOff } from '@lucide/svelte';
  import type { PlaceSummary } from '#lib/types/index.js';
  import PlaceListItem from './PlaceListItem.svelte';

  let {
    places,
    selectedId,
    onselect
  }: { places: PlaceSummary[]; selectedId: string | null; onselect: (id: string) => void } =
    $props();

  const favorites = $derived(places.filter((place) => place.isFavorite).length);
</script>

<div class="list-heading">
  <strong
    ><span class="number">{places.length}</span>
    {places.length === 1 ? 'place' : 'places'}</strong
  >
  {#if favorites}<span>{favorites} {favorites === 1 ? 'favorite' : 'favorites'}</span>{/if}
</div>
{#if places.length}
  <div class="place-list">
    {#each places as place, index (place.id)}
      <PlaceListItem
        {place}
        {index}
        selected={place.id === selectedId}
        onselect={() => onselect(place.id)}
      />
    {/each}
  </div>
{:else}
  <div class="empty">
    <span class="empty-icon"><MapPinOff size={24} /></span>
    <strong>Nothing here yet</strong>
    <span>Try loosening a filter, or click anywhere on the map to drop your first pin.</span>
  </div>
{/if}

<style>
  .list-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 0.85rem 1.1rem 0.4rem;
    color: var(--ink-muted);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .list-heading strong {
    color: var(--text-secondary);
    font-weight: 650;
  }
  .number {
    font-variant-numeric: tabular-nums;
  }
  .place-list {
    min-height: 0;
    flex: 1;
    display: grid;
    align-content: start;
    gap: 0.1rem;
    padding: 0.15rem 0.5rem 1rem;
    overflow: auto;
  }
  .empty {
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    margin: 1rem;
    padding: 2.5rem 1.5rem;
    border: 1.5px dashed var(--line-strong);
    border-radius: var(--radius-lg);
    text-align: center;
    color: var(--ink-muted);
  }
  .empty-icon {
    width: 3rem;
    height: 3rem;
    display: grid;
    place-items: center;
    margin-bottom: 0.25rem;
    border-radius: 50%;
    background: var(--surface-muted);
    color: var(--text-secondary);
  }
  .empty strong {
    color: var(--text);
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 550;
  }
  .empty span {
    max-width: 16rem;
    font-size: 0.84rem;
    line-height: 1.5;
  }
</style>
