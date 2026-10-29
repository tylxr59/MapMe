<script lang="ts">
  import { Archive, Heart, Search, SlidersHorizontal, Star, X } from '@lucide/svelte';
  import type { CategoryDTO, PlaceFilters, PlaceListDTO } from '$lib/types';
  let {
    filters,
    categories,
    lists
  }: { filters: PlaceFilters; categories: CategoryDTO[]; lists: PlaceListDTO[] } = $props();

  // svelte-ignore state_referenced_locally
  let expanded = $state(
    filters.categoryIds.length > 0 || filters.ratingMin !== null || filters.archived
  );
  const advancedCount = $derived(
    filters.categoryIds.length + (filters.ratingMin !== null ? 1 : 0) + (filters.archived ? 1 : 0)
  );
  const anyActive = $derived(
    Boolean(filters.query) ||
      filters.listIds.length > 0 ||
      filters.favorite === true ||
      advancedCount > 0
  );

  type FilterState = {
    query: string;
    listIds: string[];
    categoryIds: string[];
    favorite: boolean;
    archived: boolean;
    ratingMin: number | null;
  };

  function current(): FilterState {
    return {
      query: filters.query,
      listIds: filters.listIds,
      categoryIds: filters.categoryIds,
      favorite: filters.favorite === true,
      archived: filters.archived,
      ratingMin: filters.ratingMin
    };
  }

  function href(change: Partial<FilterState>): string {
    const next = { ...current(), ...change };
    const entries: Array<[string, string]> = [];
    if (next.query) entries.push(['q', next.query]);
    if (next.listIds.length) entries.push(['lists', next.listIds.join(',')]);
    if (next.categoryIds.length) entries.push(['categories', next.categoryIds.join(',')]);
    if (next.favorite) entries.push(['favorite', 'true']);
    if (next.archived) entries.push(['archived', 'true']);
    if (next.ratingMin !== null) entries.push(['ratingMin', String(next.ratingMin)]);
    const search = new URLSearchParams(entries).toString();
    return search ? `/?${search}` : '/';
  }

  function toggleCategory(id: string): string {
    const ids = filters.categoryIds.includes(id)
      ? filters.categoryIds.filter((value) => value !== id)
      : [...filters.categoryIds, id];
    return href({ categoryIds: ids });
  }
</script>

<div class="filters">
  <form method="GET" class="search" data-sveltekit-keepfocus data-sveltekit-noscroll>
    <Search size={17} />
    <input
      name="q"
      value={filters.query}
      placeholder="Search your places"
      aria-label="Search places"
      autocomplete="off"
      enterkeyhint="search"
    />
    {#if filters.listIds.length}<input
        type="hidden"
        name="lists"
        value={filters.listIds.join(',')}
      />{/if}
    {#if filters.categoryIds.length}<input
        type="hidden"
        name="categories"
        value={filters.categoryIds.join(',')}
      />{/if}
    {#if filters.favorite === true}<input type="hidden" name="favorite" value="true" />{/if}
    {#if filters.archived}<input type="hidden" name="archived" value="true" />{/if}
    {#if filters.ratingMin !== null}<input
        type="hidden"
        name="ratingMin"
        value={filters.ratingMin}
      />{/if}
    {#if filters.query}
      <a
        class="clear-query"
        href={href({ query: '' })}
        aria-label="Clear search"
        data-sveltekit-noscroll><X size={15} /></a
      >
    {/if}
    <button
      class="filter-toggle"
      class:active={expanded || advancedCount > 0}
      type="button"
      onclick={() => (expanded = !expanded)}
      aria-expanded={expanded}
      aria-controls="advanced-filters"
      title="Filters"
    >
      <SlidersHorizontal size={16} /><span class="sr-only">Filters</span>
      {#if advancedCount}<span class="count">{advancedCount}</span>{/if}
    </button>
  </form>

  <nav class="chips" aria-label="Lists">
    <a
      class="chip"
      href={href({ listIds: [], favorite: false })}
      aria-current={!filters.listIds.length && filters.favorite !== true ? 'true' : undefined}
      data-sveltekit-noscroll>All</a
    >
    <a
      class="chip favorite"
      href={href({ favorite: filters.favorite !== true })}
      aria-current={filters.favorite === true ? 'true' : undefined}
      data-sveltekit-noscroll
      ><Heart size={13} fill={filters.favorite === true ? 'currentColor' : 'none'} /> Favorites</a
    >
    {#each lists as list (list.id)}
      {@const active = filters.listIds.includes(list.id)}
      <a
        class="chip"
        href={href({ listIds: active ? [] : [list.id] })}
        aria-current={active ? 'true' : undefined}
        data-sveltekit-noscroll>{list.name}</a
      >
    {/each}
  </nav>

  {#if expanded}
    <div class="advanced" id="advanced-filters">
      <div class="group">
        <span class="group-label">Categories</span>
        <div class="category-chips">
          {#each categories as category (category.id)}
            {@const active = filters.categoryIds.includes(category.id)}
            <a
              class="chip category"
              href={toggleCategory(category.id)}
              aria-current={active ? 'true' : undefined}
              style:--category={category.color}
              data-sveltekit-noscroll
            >
              <span class="glyph">{@html category.iconSvg}</span>{category.name}
            </a>
          {/each}
        </div>
      </div>
      <div class="group row">
        <span class="group-label">Rating</span>
        <div class="segmented" role="group" aria-label="Minimum rating">
          {#each [null, 3, 4, 5] as value (value)}
            <a
              href={href({ ratingMin: value })}
              aria-current={filters.ratingMin === value ? 'true' : undefined}
              data-sveltekit-noscroll
            >
              {#if value === null}Any{:else}{value}{#if value < 5}+{/if}<Star
                  size={11}
                  fill="currentColor"
                />{/if}
            </a>
          {/each}
        </div>
      </div>
      <div class="group row">
        <span class="group-label">Show</span>
        <a
          class="chip"
          href={href({ archived: !filters.archived })}
          aria-current={filters.archived ? 'true' : undefined}
          data-sveltekit-noscroll><Archive size={13} /> Archived only</a
        >
      </div>
      {#if anyActive}
        <a class="reset" href="/" data-sveltekit-noscroll><X size={14} /> Clear all filters</a>
      {/if}
    </div>
  {/if}
</div>

<style>
  .filters {
    display: grid;
    gap: 0.7rem;
    padding: 0.6rem 1rem 0.85rem;
    border-bottom: 1px solid var(--line);
  }
  .search {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.85rem;
    margin: 0;
    padding: 0 0.35rem 0 0.85rem;
    border: 1px solid var(--input-border);
    border-radius: var(--radius-md);
    background: var(--input-bg);
    color: var(--ink-muted);
    box-shadow: inset 0 1px 2px var(--shadow-soft);
    transition:
      border-color 120ms ease,
      box-shadow 120ms ease;
  }
  .search:focus-within {
    border-color: var(--brand-text);
    box-shadow: 0 0 0 4px var(--focus-ring);
    color: var(--brand-text);
  }
  .search input {
    min-width: 0;
    flex: 1;
    padding: 0.6rem 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--text);
  }
  .clear-query {
    display: grid;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 50%;
    background: var(--surface-muted);
    color: var(--text-secondary);
  }
  .filter-toggle {
    position: relative;
    display: grid;
    place-items: center;
    width: 2.2rem;
    height: 2.2rem;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-secondary);
    transition:
      background 120ms ease,
      color 120ms ease;
  }
  .filter-toggle:hover,
  .filter-toggle.active {
    background: var(--surface-muted);
    color: var(--text);
  }
  .count {
    position: absolute;
    top: -0.2rem;
    right: -0.2rem;
    min-width: 1.05rem;
    height: 1.05rem;
    display: grid;
    place-items: center;
    padding: 0 0.25rem;
    border: 2px solid var(--input-bg);
    border-radius: 999px;
    background: var(--vermilion);
    color: white;
    font-size: 0.6rem;
    font-weight: 700;
  }

  .chips {
    display: flex;
    gap: 0.4rem;
    margin: 0 -1rem;
    padding: 0 1rem 0.1rem;
    overflow-x: auto;
    scrollbar-width: none;
    mask-image: linear-gradient(
      90deg,
      transparent,
      #000 1rem,
      #000 calc(100% - 1.5rem),
      transparent
    );
  }
  .chips::-webkit-scrollbar {
    display: none;
  }
  .chip {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 0.35rem;
    min-height: 2rem;
    padding: 0.35rem 0.75rem;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.8rem;
    font-weight: 550;
    text-decoration: none;
    white-space: nowrap;
    transition:
      background 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
  }
  .chip:hover {
    border-color: var(--ink-muted);
    color: var(--text);
  }
  .chip[aria-current='true'] {
    border-color: var(--text);
    background: var(--text);
    color: var(--paper);
  }
  .chip.favorite[aria-current='true'] {
    border-color: var(--marigold);
    background: var(--marigold);
    color: #2b1d00;
  }

  .advanced {
    display: grid;
    gap: 0.85rem;
    padding: 0.85rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface-raised);
    animation: reveal 220ms var(--ease-out);
  }
  .group {
    display: grid;
    gap: 0.45rem;
  }
  .group.row {
    grid-template-columns: 4.2rem 1fr;
    align-items: center;
    justify-items: start;
  }
  .group-label {
    color: var(--ink-muted);
    font-size: 0.68rem;
    font-weight: 650;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .category-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .chip.category {
    min-height: 1.85rem;
    padding: 0.25rem 0.6rem 0.25rem 0.3rem;
    font-size: 0.76rem;
  }
  .glyph {
    width: 1.3rem;
    height: 1.3rem;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: color-mix(in srgb, var(--category) 16%, transparent);
    color: var(--category);
  }
  .glyph :global(svg) {
    width: 0.8rem;
    height: 0.8rem;
  }
  .chip.category[aria-current='true'] {
    border-color: var(--category);
    background: var(--category);
    color: white;
  }
  .chip.category[aria-current='true'] .glyph {
    background: #ffffff33;
    color: white;
  }
  .segmented {
    display: inline-flex;
    padding: 0.2rem;
    border-radius: var(--radius-sm);
    background: var(--surface-muted);
  }
  .segmented a {
    display: inline-flex;
    align-items: center;
    gap: 0.15rem;
    padding: 0.3rem 0.65rem;
    border-radius: calc(var(--radius-sm) - 0.15rem);
    color: var(--text-secondary);
    font-size: 0.78rem;
    font-weight: 600;
    text-decoration: none;
  }
  .segmented a :global(svg) {
    color: var(--marigold);
  }
  .segmented a[aria-current='true'] {
    background: var(--surface-raised);
    color: var(--text);
    box-shadow:
      0 1px 2px var(--shadow-soft),
      0 0 0 1px var(--line);
  }
  .reset {
    display: inline-flex;
    align-items: center;
    justify-self: start;
    gap: 0.3rem;
    color: var(--danger);
    font-size: 0.78rem;
    font-weight: 600;
    text-decoration: none;
  }
  .reset:hover {
    text-decoration: underline;
  }
  @keyframes reveal {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
</style>
