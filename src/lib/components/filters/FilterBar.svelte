<script lang="ts">
  import { Search, SlidersHorizontal, X } from '@lucide/svelte';
  import type { CategoryDTO, PlaceFilters } from '$lib/types';
  let { filters, categories }: { filters: PlaceFilters; categories: CategoryDTO[] } = $props();
  let expanded = $state(false);
</script>

<form method="GET" class="filters">
  <div class="search-row">
    <Search size={17} />
    <input
      name="q"
      value={filters.query}
      placeholder="Search saved places…"
      aria-label="Search places"
    />
    <button
      class="filter-toggle"
      type="button"
      onclick={() => (expanded = !expanded)}
      aria-expanded={expanded}
    >
      <SlidersHorizontal size={17} /><span>Filters</span>
    </button>
  </div>
  {#if expanded}
    <div class="filter-grid">
      <label
        >Status
        <select name="statuses">
          <option value="">Any status</option>
          <option value="saved" selected={filters.statuses.includes('saved')}>Saved</option>
          <option value="want_to_go" selected={filters.statuses.includes('want_to_go')}
            >Want to go</option
          >
          <option value="visited" selected={filters.statuses.includes('visited')}>Visited</option>
        </select>
      </label>
      <label
        >Category
        <select name="categories">
          <option value="">Any category</option>
          {#each categories as category}
            <option value={category.id} selected={filters.categoryIds.includes(category.id)}
              >{category.name}</option
            >
          {/each}
        </select>
      </label>
      <label
        >Visited
        <select name="visited" value={filters.visited}>
          <option value="any">Any</option>
          <option value="visited">Visited</option>
          <option value="unvisited">Unvisited</option>
        </select>
      </label>
      <label
        >Rating
        <select name="ratingMin" value={filters.ratingMin ?? ''}>
          <option value="">Any rating</option>
          <option value="3">3+ stars</option>
          <option value="4">4+ stars</option>
          <option value="5">5 stars</option>
        </select>
      </label>
      <label
        >Sort
        <select name="sort" value={filters.sort}>
          <option value="updated_desc">Recently updated</option>
          <option value="name_asc">Name</option>
          <option value="rating_desc">Rating</option>
          <option value="visited_desc">Date visited</option>
        </select>
      </label>
      <label class="check"
        ><input type="checkbox" name="favorite" value="true" checked={filters.favorite === true} /> Favorites
        only</label
      >
      <label class="check"
        ><input type="checkbox" name="archived" value="true" checked={filters.archived} /> Archived only</label
      >
      <div class="actions">
        <a href="/"><X size={15} /> Clear</a>
        <button type="submit">Apply filters</button>
      </div>
    </div>
  {/if}
</form>

<style>
  .filters {
    padding: 0.7rem;
    border-bottom: 1px solid var(--line);
    background: var(--cream);
  }
  .search-row {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    min-height: 2.65rem;
    padding: 0 0.65rem;
    border: 1px solid var(--input-border);
    border-radius: 0.75rem;
    background: var(--input-bg);
    color: var(--text);
  }
  .search-row input {
    min-width: 0;
    flex: 1;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--text);
  }
  .filter-toggle {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    border: 0;
    background: transparent;
    color: var(--green-800);
    font-weight: 700;
  }
  .filter-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem;
    padding: 0.8rem 0.1rem 0.1rem;
  }
  label {
    display: grid;
    gap: 0.25rem;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--text-secondary);
  }
  select {
    width: 100%;
    padding: 0.52rem;
    border: 1px solid var(--input-border);
    border-radius: 0.5rem;
    background: var(--input-bg);
    color: var(--text);
  }
  .check {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
  }
  .actions {
    grid-column: 1 / -1;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.7rem;
  }
  .actions a {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    color: var(--ink-muted);
    text-decoration: none;
    font-size: 0.78rem;
  }
  .actions button {
    border: 0;
    border-radius: 0.55rem;
    background: var(--accent-bg);
    color: var(--accent-text);
    padding: 0.55rem 0.75rem;
    font-weight: 700;
  }
  @media (max-width: 500px) {
    .filter-grid {
      grid-template-columns: 1fr;
    }
    .actions {
      grid-column: 1;
    }
  }
</style>
