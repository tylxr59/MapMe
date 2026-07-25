<script lang="ts">
  import { enhance } from '$app/forms';
  import {
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    LockKeyhole,
    MapPinned,
    Pencil,
    Plus,
    Save,
    Trash2,
    X
  } from '@lucide/svelte';
  import { categoryIconSvg, suggestedCategoryIcons } from '$lib/icons/category-icons';

  let { data, form } = $props();
  let showCreate = $state(false);
  let newIcon = $state<(typeof suggestedCategoryIcons)[number]>('pin');
  let newColor = $state('#26734C');
  let draftIcons = $state<Record<string, string>>({});
  let draftColors = $state<Record<string, string>>({});

  const iconLabel = (name: string) =>
    name
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const categoryIcon = (id: string, fallback: string) => draftIcons[id] ?? fallback;
  const categoryColor = (id: string, fallback: string) => draftColors[id] ?? fallback;
  const placeLabel = (count: number) => `${count} ${count === 1 ? 'place' : 'places'}`;
  const totalPlaces = () =>
    data.categories.reduce(
      (total: number, category: (typeof data.categories)[number]) =>
        total + (category.placeCount ?? 0),
      0
    );
</script>

<svelte:head><title>Categories · MapMe</title></svelte:head>

<div class="page-heading">
  <div class="heading-copy">
    <span class="eyebrow">Organization</span>
    <h1>Categories</h1>
    <p>Give every place a recognizable marker and keep your map easy to scan.</p>
  </div>

  <div class="heading-actions">
    <div class="overview" aria-label="Category overview">
      <div>
        <strong>{data.categories.length}</strong>
        <span>categories</span>
      </div>
      <div>
        <strong>{totalPlaces()}</strong>
        <span>places</span>
      </div>
    </div>
    <button
      class="primary-button"
      type="button"
      aria-expanded={showCreate}
      aria-controls="new-category"
      onclick={() => (showCreate = !showCreate)}
    >
      {#if showCreate}<X size={17} /> Close{:else}<Plus size={17} /> Add category{/if}
    </button>
  </div>
</div>

{#if form?.message}
  <div class:success={form.success} class:alert={!form.success} class="notice" role="status">
    {#if form.success}<CheckCircle2 size={18} />{:else}<AlertTriangle size={18} />{/if}
    <span>{form.message}</span>
  </div>
{/if}

{#if showCreate}
  <section class="create-card" id="new-category">
    <div class="create-intro">
      <div class="marker-preview large" style:background={newColor}>
        {@html categoryIconSvg(newIcon)}
      </div>
      <div>
        <span class="section-kicker">New marker</span>
        <h2>Create a category</h2>
        <p>Choose a short name, icon, and color that will stand out on your map.</p>
      </div>
    </div>

    <form method="POST" action="?/save" use:enhance class="create-form">
      <label class="name-field">
        <span>Name</span>
        <input name="name" required maxlength="80" placeholder="e.g. Bookstores" />
      </label>
      <label>
        <span>Icon</span>
        <select
          name="iconName"
          value={newIcon}
          onchange={(event) =>
            (newIcon = event.currentTarget.value as (typeof suggestedCategoryIcons)[number])}
        >
          {#each suggestedCategoryIcons as icon}
            <option value={icon}>{iconLabel(icon)}</option>
          {/each}
        </select>
      </label>
      <label class="color-field">
        <span>Color</span>
        <span class="color-control">
          <input
            name="color"
            type="color"
            value={newColor}
            aria-label="Marker color"
            oninput={(event) => (newColor = event.currentTarget.value)}
          />
          <output>{newColor.toUpperCase()}</output>
        </span>
      </label>
      <label class="order-field">
        <span>Display order</span>
        <input name="sortOrder" type="number" value="100" />
      </label>
      <button type="submit" class="primary-button create-submit">
        <Plus size={17} /> Add category
      </button>
    </form>
  </section>
{/if}

<div class="section-heading">
  <div>
    <h2>Your categories</h2>
    <p>Categories appear in this order in filters and place forms.</p>
  </div>
  <span>{data.categories.length} total</span>
</div>

<section class="category-list" aria-label="Your categories">
  {#each data.categories as category}
    <details class="category-card">
      <summary>
        <span class="marker-preview" style:background={categoryColor(category.id, category.color)}>
          {@html categoryIconSvg(categoryIcon(category.id, category.iconName))}
        </span>
        <span class="category-summary">
          <span class="category-name">
            {category.name}
            {#if category.isSystem}
              <span class="system-badge"><LockKeyhole size={11} /> Default</span>
            {/if}
          </span>
          <span class="category-meta">
            <span>{placeLabel(category.placeCount ?? 0)}</span>
            <span aria-hidden="true">·</span>
            <span>{iconLabel(category.iconName)}</span>
            <span aria-hidden="true">·</span>
            <span>Order {category.sortOrder}</span>
          </span>
        </span>
        <span class="edit-affordance"><Pencil size={15} /> Edit <ChevronDown size={16} /></span>
      </summary>

      <div class="editor">
        <form method="POST" action="?/save" use:enhance class="edit-form">
          <input type="hidden" name="id" value={category.id} />
          <label class="name-field">
            <span>Name</span>
            <input name="name" value={category.name} required maxlength="80" />
          </label>
          <label>
            <span>Icon</span>
            <select
              name="iconName"
              value={category.iconName}
              onchange={(event) => {
                draftIcons[category.id] = event.currentTarget.value;
              }}
            >
              {#each suggestedCategoryIcons as icon}
                <option value={icon}>{iconLabel(icon)}</option>
              {/each}
            </select>
          </label>
          <label class="color-field">
            <span>Color</span>
            <span class="color-control">
              <input
                name="color"
                type="color"
                value={category.color}
                aria-label={`${category.name} marker color`}
                oninput={(event) => {
                  draftColors[category.id] = event.currentTarget.value;
                }}
              />
              <output>{categoryColor(category.id, category.color).toUpperCase()}</output>
            </span>
          </label>
          <label class="order-field">
            <span>Display order</span>
            <input name="sortOrder" type="number" value={category.sortOrder} />
          </label>
          <button type="submit" class="primary-button save-button">
            <Save size={16} /> Save changes
          </button>
        </form>

        <div class="editor-footer">
          {#if category.isSystem}
            <p class="system-note">
              <LockKeyhole size={15} />
              This is MapMe’s fallback category. You can customize it, but it can’t be deleted.
            </p>
          {:else}
            <details class="danger-disclosure">
              <summary><Trash2 size={15} /> Delete category</summary>
              <div class="danger-content">
                <div>
                  <strong>Move its places before deleting</strong>
                  <p>
                    {placeLabel(category.placeCount ?? 0)} will be reassigned so nothing disappears from
                    your map.
                  </p>
                </div>
                <form method="POST" action="?/delete" use:enhance>
                  <input type="hidden" name="id" value={category.id} />
                  <label>
                    <span>Reassign to</span>
                    <select name="replacementId" required>
                      {#each data.categories.filter((item) => item.id !== category.id) as replacement}
                        <option value={replacement.id}>{replacement.name}</option>
                      {/each}
                    </select>
                  </label>
                  <button type="submit" class="delete-button">
                    <Trash2 size={15} /> Delete {category.name}
                  </button>
                </form>
              </div>
            </details>
          {/if}
        </div>
      </div>
    </details>
  {:else}
    <div class="empty-state">
      <MapPinned size={28} />
      <h2>No categories yet</h2>
      <p>Add your first category to create a marker for your places.</p>
      <button type="button" class="primary-button" onclick={() => (showCreate = true)}>
        <Plus size={17} /> Add category
      </button>
    </div>
  {/each}
</section>

<style>
  .page-heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 2rem;
    margin-bottom: 1.5rem;
  }
  .eyebrow,
  .section-kicker {
    color: var(--green-700);
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  h1 {
    margin: 0.22rem 0 0.3rem;
    font-size: clamp(1.7rem, 3vw, 2.15rem);
    letter-spacing: -0.035em;
  }
  .heading-copy p,
  .create-intro p,
  .section-heading p,
  .danger-content p,
  .empty-state p {
    color: var(--ink-muted);
    margin: 0;
  }
  .heading-actions {
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }
  .overview {
    display: flex;
    gap: 1.2rem;
  }
  .overview div {
    display: grid;
    gap: 0.05rem;
  }
  .overview strong {
    font-size: 1.05rem;
    line-height: 1;
  }
  .overview span {
    color: var(--ink-muted);
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  button {
    border: 0;
    font-weight: 750;
  }
  .primary-button {
    min-height: 2.55rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border-radius: 0.65rem;
    background: var(--accent-bg);
    color: var(--accent-text);
    padding: 0.6rem 0.85rem;
    white-space: nowrap;
  }
  .primary-button:hover {
    filter: brightness(1.08);
  }
  .primary-button:focus-visible,
  .delete-button:focus-visible,
  summary:focus-visible,
  input:focus-visible,
  select:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .notice {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    border: 1px solid transparent;
    border-radius: 0.7rem;
    margin-bottom: 1rem;
    padding: 0.75rem 0.85rem;
    font-size: 0.85rem;
    font-weight: 700;
  }
  .notice.success {
    background: var(--success-bg);
    color: var(--success-text);
  }
  .notice.alert {
    background: var(--danger-bg);
    color: var(--danger-text);
  }
  .create-card {
    border: 1px solid color-mix(in srgb, var(--green-700) 38%, var(--line));
    border-radius: 1rem;
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--green-100) 45%, transparent),
        transparent 55%
      ),
      var(--cream);
    margin-bottom: 1.5rem;
    padding: 1.1rem;
    box-shadow: 0 8px 28px var(--shadow-soft);
  }
  .create-intro {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding-bottom: 1rem;
  }
  .create-intro h2 {
    margin: 0.1rem 0 0.2rem;
    font-size: 1.08rem;
  }
  .create-intro p,
  .section-heading p {
    font-size: 0.8rem;
  }
  .marker-preview {
    width: 2.75rem;
    height: 2.75rem;
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    border: 2px solid #ffffff;
    border-radius: 50% 50% 50% 0.55rem;
    color: #ffffff;
    box-shadow: 0 3px 10px #14291d35;
    transform: rotate(-45deg);
  }
  .marker-preview :global(svg) {
    width: 1.25rem;
    height: 1.25rem;
    transform: rotate(45deg);
  }
  .marker-preview.large {
    width: 3.15rem;
    height: 3.15rem;
  }
  .create-form,
  .edit-form {
    display: grid;
    grid-template-columns: minmax(180px, 1.5fr) minmax(145px, 1fr) minmax(135px, 0.9fr) 110px auto;
    align-items: end;
    gap: 0.75rem;
  }
  label {
    min-width: 0;
    display: grid;
    gap: 0.35rem;
  }
  label > span:first-child {
    color: var(--text-secondary);
    font-size: 0.7rem;
    font-weight: 800;
  }
  input,
  select {
    width: 100%;
    min-width: 0;
    min-height: 2.55rem;
    border: 1px solid var(--input-border);
    border-radius: 0.6rem;
    background: var(--input-bg);
    color: var(--text);
    padding: 0.55rem 0.65rem;
  }
  input:hover,
  select:hover {
    border-color: var(--green-700);
  }
  .color-control {
    min-height: 2.55rem;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    border: 1px solid var(--input-border);
    border-radius: 0.6rem;
    background: var(--input-bg);
    padding: 0.28rem 0.55rem 0.28rem 0.3rem;
  }
  .color-control input {
    width: 2.25rem;
    min-height: 1.9rem;
    border: 0;
    border-radius: 0.4rem;
    padding: 0;
    overflow: hidden;
  }
  .color-control output {
    color: var(--text-secondary);
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }
  .section-heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
    margin: 0 0 0.7rem;
  }
  .section-heading h2 {
    margin: 0 0 0.12rem;
    font-size: 1rem;
  }
  .section-heading > span {
    color: var(--ink-muted);
    font-size: 0.72rem;
    font-weight: 750;
  }
  .category-list {
    display: grid;
    gap: 0.65rem;
  }
  .category-card {
    border: 1px solid var(--line);
    border-radius: 0.9rem;
    background: var(--cream);
    box-shadow: 0 2px 10px var(--shadow-soft);
    overflow: hidden;
    transition:
      border-color 150ms ease,
      box-shadow 150ms ease;
  }
  .category-card:hover,
  .category-card[open] {
    border-color: color-mix(in srgb, var(--green-700) 35%, var(--line));
    box-shadow: 0 6px 20px var(--shadow-soft);
  }
  .category-card > summary {
    min-height: 4.65rem;
    display: flex;
    align-items: center;
    gap: 0.9rem;
    padding: 0.8rem 1rem;
    cursor: pointer;
    list-style: none;
    user-select: none;
  }
  .category-card > summary::-webkit-details-marker,
  .danger-disclosure > summary::-webkit-details-marker {
    display: none;
  }
  .category-summary {
    min-width: 0;
    display: grid;
    flex: 1;
    gap: 0.25rem;
  }
  .category-name {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.95rem;
    font-weight: 800;
  }
  .category-meta {
    display: flex;
    align-items: center;
    gap: 0.38rem;
    color: var(--ink-muted);
    font-size: 0.72rem;
  }
  .system-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.22rem;
    border-radius: 999px;
    background: var(--badge-bg);
    color: var(--badge-text);
    padding: 0.2rem 0.42rem;
    font-size: 0.62rem;
    font-weight: 800;
  }
  .edit-affordance {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border-radius: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.75rem;
    font-weight: 750;
  }
  .edit-affordance :global(svg:last-child) {
    margin-left: 0.2rem;
    transition: transform 150ms ease;
  }
  .category-card[open] .edit-affordance :global(svg:last-child) {
    transform: rotate(180deg);
  }
  .editor {
    border-top: 1px solid var(--line);
    background: color-mix(in srgb, var(--surface-muted) 34%, var(--cream));
    padding: 1rem;
  }
  .editor-footer {
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid var(--line);
    margin-top: 1rem;
    padding-top: 0.8rem;
  }
  .system-note {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    color: var(--ink-muted);
    margin: 0;
    font-size: 0.75rem;
  }
  .danger-disclosure {
    width: 100%;
  }
  .danger-disclosure > summary {
    width: max-content;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-left: auto;
    color: var(--danger);
    cursor: pointer;
    font-size: 0.73rem;
    font-weight: 750;
    list-style: none;
  }
  .danger-content {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1.5rem;
    border: 1px solid color-mix(in srgb, var(--danger) 22%, var(--line));
    border-radius: 0.7rem;
    background: var(--danger-soft);
    margin-top: 0.7rem;
    padding: 0.8rem;
  }
  .danger-content strong {
    color: var(--danger);
    font-size: 0.8rem;
  }
  .danger-content p {
    margin-top: 0.2rem;
    font-size: 0.72rem;
  }
  .danger-content form {
    display: flex;
    align-items: end;
    gap: 0.55rem;
  }
  .danger-content select {
    min-width: 150px;
  }
  .delete-button {
    min-height: 2.55rem;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border-radius: 0.6rem;
    background: var(--danger);
    color: #ffffff;
    padding: 0.55rem 0.75rem;
    white-space: nowrap;
  }
  .empty-state {
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    border: 1px dashed var(--input-border);
    border-radius: 1rem;
    color: var(--green-700);
    padding: 3rem 1rem;
    text-align: center;
  }
  .empty-state h2 {
    color: var(--text);
    margin: 0.25rem 0 0;
    font-size: 1rem;
  }
  .empty-state .primary-button {
    margin-top: 0.5rem;
  }
  @media (max-width: 900px) {
    .create-form,
    .edit-form {
      grid-template-columns: 1.4fr 1fr 1fr 100px;
    }
    .create-submit,
    .save-button {
      grid-column: 1 / -1;
      justify-self: end;
    }
  }
  @media (max-width: 680px) {
    .page-heading {
      align-items: stretch;
      flex-direction: column;
      gap: 1rem;
    }
    .heading-actions {
      justify-content: space-between;
    }
    .create-form,
    .edit-form {
      grid-template-columns: 1fr 1fr;
    }
    .name-field {
      grid-column: 1 / -1;
    }
    .create-submit,
    .save-button {
      width: 100%;
    }
    .category-card > summary {
      gap: 0.7rem;
      padding-inline: 0.8rem;
    }
    .edit-affordance {
      font-size: 0;
      gap: 0.15rem;
    }
    .category-meta span:nth-child(n + 4) {
      display: none;
    }
    .danger-content,
    .danger-content form {
      align-items: stretch;
      flex-direction: column;
    }
    .danger-content select,
    .delete-button {
      width: 100%;
    }
  }
  @media (max-width: 430px) {
    .overview {
      gap: 0.8rem;
    }
    .heading-actions {
      gap: 0.6rem;
    }
    .create-form,
    .edit-form {
      grid-template-columns: 1fr;
    }
    .name-field {
      grid-column: auto;
    }
    .category-meta span:nth-child(n + 2) {
      display: none;
    }
    .marker-preview {
      width: 2.5rem;
      height: 2.5rem;
    }
  }
</style>
