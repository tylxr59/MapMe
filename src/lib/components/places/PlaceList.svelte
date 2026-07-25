<script lang="ts">
  import { MapPinOff } from '@lucide/svelte';
  import type { PlaceSummary } from '$lib/types';
  import PlaceListItem from './PlaceListItem.svelte';

  let {
    places,
    selectedId,
    onselect
  }: { places: PlaceSummary[]; selectedId: string | null; onselect: (id: string) => void } =
    $props();
</script>

<div class="list-heading">
  <strong>{places.length} {places.length === 1 ? 'place' : 'places'}</strong>
</div>
{#if places.length}
  <div class="place-list">
    {#each places as place (place.id)}
      <PlaceListItem
        {place}
        selected={place.id === selectedId}
        onselect={() => onselect(place.id)}
      />
    {/each}
  </div>
{:else}
  <div class="empty">
    <MapPinOff size={28} />
    <strong>No places found</strong>
    <span>Try clearing a filter or add your first place.</span>
  </div>
{/if}

<style>
  .list-heading {
    padding: 0.7rem 1rem;
    border-bottom: 1px solid var(--line);
    font-size: 0.78rem;
    color: var(--ink-muted);
  }
  .place-list {
    overflow: auto;
  }
  .empty {
    display: grid;
    justify-items: center;
    gap: 0.45rem;
    padding: 3rem 1rem;
    text-align: center;
    color: var(--ink-muted);
  }
  .empty strong {
    color: var(--text);
  }
  .empty span {
    font-size: 0.85rem;
  }
</style>
