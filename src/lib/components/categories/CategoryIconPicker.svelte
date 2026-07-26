<script lang="ts">
  import { ExternalLink, Search } from '@lucide/svelte';
  import {
    categoryIconSvg,
    isValidCategoryIcon,
    searchCategoryIcons
  } from '$lib/icons/category-icons';

  let {
    value,
    onchange
  }: {
    value: string;
    onchange: (value: string) => void;
  } = $props();

  let query = $state('');
  const matches = $derived(searchCategoryIcons(query));
  const valid = $derived(isValidCategoryIcon(value));
</script>

<div class="icon-picker">
  <div class="picker-heading">
    <span>Icon</span>
    <a href="https://lucide.dev/icons/" target="_blank" rel="noreferrer noopener">
      Browse Lucide icons <ExternalLink size={12} />
    </a>
  </div>

  <div class:invalid={!valid} class="icon-id-field">
    <span class="selected-preview">{@html categoryIconSvg(value)}</span>
    <input
      name="iconName"
      {value}
      required
      aria-invalid={!valid}
      aria-describedby={!valid ? 'invalid-icon-help' : undefined}
      placeholder="Lucide icon ID, e.g. target"
      oninput={(event) => onchange(event.currentTarget.value.trim().toLowerCase())}
    />
  </div>
  {#if !valid}
    <small id="invalid-icon-help" class="invalid-help">Enter a valid Lucide icon ID.</small>
  {/if}

  <label class="search-field">
    <Search size={15} />
    <input
      bind:value={query}
      type="search"
      placeholder="Search places: shooting range, overlanding, urbex…"
      aria-label="Search category icons"
    />
  </label>

  <div class="icon-results" role="listbox" aria-label="Matching icons">
    {#each matches as icon}
      <button
        type="button"
        class:selected={value === icon}
        role="option"
        aria-selected={value === icon}
        title={icon}
        onclick={() => onchange(icon)}
      >
        {@html categoryIconSvg(icon)}
        <span>{icon}</span>
      </button>
    {:else}
      <p>No close matches. You can still paste any Lucide icon ID above.</p>
    {/each}
  </div>
</div>

<style>
  .icon-picker {
    min-width: 0;
    display: grid;
    gap: 0.45rem;
  }
  .picker-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .picker-heading > span {
    color: var(--text-secondary);
    font-size: 0.7rem;
    font-weight: 800;
  }
  .picker-heading a {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    color: var(--green-700);
    font-size: 0.68rem;
    font-weight: 750;
    text-decoration: none;
  }
  .picker-heading a:hover {
    text-decoration: underline;
  }
  .icon-id-field,
  .search-field {
    min-height: 2.55rem;
    display: flex;
    align-items: center;
    gap: 0.45rem;
    border: 1px solid var(--input-border);
    border-radius: 0.6rem;
    background: var(--input-bg);
    padding: 0 0.55rem;
  }
  .icon-id-field:focus-within,
  .search-field:focus-within {
    border-color: var(--green-700);
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .icon-id-field.invalid {
    border-color: var(--danger);
  }
  .selected-preview {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    color: var(--green-700);
  }
  .selected-preview :global(svg) {
    width: 1.15rem;
    height: 1.15rem;
  }
  input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--text);
    padding: 0.55rem 0;
  }
  .search-field {
    color: var(--ink-muted);
  }
  .invalid-help {
    color: var(--danger);
    font-size: 0.68rem;
  }
  .icon-results {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(86px, 1fr));
    gap: 0.35rem;
    max-height: 13rem;
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: 0.65rem;
    background: var(--surface-muted);
    padding: 0.4rem;
  }
  .icon-results button {
    min-width: 0;
    display: grid;
    justify-items: center;
    gap: 0.28rem;
    border: 1px solid transparent;
    border-radius: 0.48rem;
    background: var(--cream);
    color: var(--text-secondary);
    padding: 0.48rem 0.3rem;
    font-size: 0.61rem;
    cursor: pointer;
  }
  .icon-results button:hover,
  .icon-results button.selected {
    border-color: var(--green-700);
    background: var(--surface-selected);
    color: var(--green-800);
  }
  .icon-results button:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 1px;
  }
  .icon-results button :global(svg) {
    width: 1.15rem;
    height: 1.15rem;
  }
  .icon-results button span {
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .icon-results p {
    grid-column: 1 / -1;
    color: var(--ink-muted);
    margin: 0;
    padding: 0.8rem;
    font-size: 0.72rem;
  }
</style>
