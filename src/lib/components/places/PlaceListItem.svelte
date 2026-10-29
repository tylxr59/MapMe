<script lang="ts">
  import { Archive, Camera, Heart, Star } from '@lucide/svelte';
  import type { PlaceSummary } from '#lib/types/index.js';

  let {
    place,
    selected,
    index = 0,
    onselect
  }: { place: PlaceSummary; selected: boolean; index?: number; onselect: () => void } = $props();
</script>

<button
  class:selected
  class:archived={place.isArchived}
  class="place-row"
  type="button"
  onclick={onselect}
  aria-current={selected ? 'true' : undefined}
  style:--category={place.category.color}
  style:--delay={`${Math.min(index, 12) * 22}ms`}
>
  <span class="category-tile" aria-hidden="true">
    {@html place.category.iconSvg}
  </span>
  <span class="copy">
    <span class="title-row">
      <strong>{place.name}</strong>
      {#if place.isFavorite}<Heart
          class="favorite"
          size={13}
          fill="currentColor"
          aria-label="Favorite"
        />{/if}
    </span>
    <span class="address">{place.address || place.category.name}</span>
    <span class="meta">
      <span class="list-name">{place.list.name}</span>
      {#if place.rating}
        <span class="rating" aria-label={`${place.rating} out of 5 stars`}>
          <Star size={11} fill="currentColor" />{place.rating}
        </span>
      {/if}
      {#if place.attachmentCount}<span><Camera size={12} /> {place.attachmentCount}</span>{/if}
      {#if place.isArchived}<span><Archive size={12} aria-label="Archived" /> Archived</span>{/if}
    </span>
  </span>
</button>

<style>
  .place-row {
    position: relative;
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 0.8rem;
    padding: 0.75rem 0.7rem;
    text-align: left;
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    color: inherit;
    transition: background 120ms ease;
    animation: row-in 360ms var(--ease-out) both;
    animation-delay: var(--delay);
  }
  .place-row:hover {
    background: var(--surface-muted);
  }
  .place-row.selected {
    background: var(--surface-raised);
    box-shadow:
      0 0 0 1px var(--line),
      0 4px 14px -6px var(--shadow-panel);
  }
  .place-row.selected::before {
    content: '';
    position: absolute;
    left: -0.5rem;
    top: 0.9rem;
    bottom: 0.9rem;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: var(--category);
  }
  .place-row.archived .copy {
    opacity: 0.6;
  }
  .category-tile {
    width: 2.5rem;
    height: 2.5rem;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--category) 14%, var(--cream));
    color: color-mix(in srgb, var(--category) 85%, var(--text));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--category) 20%, transparent);
    transition: transform 200ms var(--ease-spring);
  }
  .place-row:hover .category-tile,
  .place-row.selected .category-tile {
    transform: scale(1.05) rotate(-3deg);
  }
  .place-row.selected .category-tile {
    background: var(--category);
    color: white;
  }
  .category-tile :global(svg) {
    width: 1.15rem;
    height: 1.15rem;
  }
  .copy {
    min-width: 0;
    flex: 1;
    display: grid;
    gap: 0.12rem;
  }
  .title-row {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  strong {
    min-width: 0;
    overflow: hidden;
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .title-row :global(.favorite) {
    flex: 0 0 auto;
    color: var(--marigold);
  }
  .address {
    overflow: hidden;
    color: var(--text-secondary);
    font-size: 0.8rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.6rem;
    margin-top: 0.2rem;
    color: var(--ink-muted);
    font-size: 0.72rem;
  }
  .meta > span {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
  }
  .list-name {
    padding: 0.05rem 0.45rem;
    border-radius: 999px;
    background: var(--badge-bg);
    color: var(--badge-text);
    font-weight: 600;
  }
  .rating {
    color: var(--text-secondary);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .rating :global(svg) {
    color: var(--marigold);
  }
  @keyframes row-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .place-row,
    .category-tile {
      animation: none;
      transition: none;
    }
  }
</style>
