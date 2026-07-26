<script lang="ts">
  import { enhance } from '$app/forms';
  import {
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ListChecks,
    LockKeyhole,
    Plus,
    Save,
    Trash2,
    X
  } from '@lucide/svelte';

  let { data, form } = $props();
  let showCreate = $state(false);
  const placeLabel = (count: number) => `${count} ${count === 1 ? 'place' : 'places'}`;
  const totalPlaces = () =>
    data.lists.reduce(
      (total: number, list: (typeof data.lists)[number]) => total + (list.placeCount ?? 0),
      0
    );
</script>

<svelte:head><title>Lists · MapMe</title></svelte:head>

<div class="page-heading">
  <h1>Lists</h1>
  <div class="heading-actions">
    <div class="overview" aria-label="List overview">
      <div><strong>{data.lists.length}</strong><span>lists</span></div>
      <div><strong>{totalPlaces()}</strong><span>places</span></div>
    </div>
    <button
      class="primary-button"
      type="button"
      aria-expanded={showCreate}
      aria-controls="new-list"
      onclick={() => (showCreate = !showCreate)}
    >
      {#if showCreate}<X size={17} /> Close{:else}<Plus size={17} /> Add list{/if}
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
  <section class="create-card" id="new-list">
    <div class="list-symbol"><ListChecks size={21} /></div>
    <form method="POST" action="?/save" use:enhance class="create-form">
      <label>
        <span>Name</span>
        <input name="name" required maxlength="80" placeholder="e.g. Honeymoon options" />
      </label>
      <button type="submit" class="primary-button"><Plus size={17} /> Add list</button>
    </form>
  </section>
{/if}

<div class="section-heading"><h2>Your lists</h2></div>

<section class="list-grid" aria-label="Your lists">
  {#each data.lists as list (list.id)}
    <details class="list-card">
      <summary>
        <span class="list-symbol"><ListChecks size={19} /></span>
        <span class="list-summary">
          <span class="list-name">
            {list.name}
            {#if list.isSystem}
              <span class="system-badge"><LockKeyhole size={11} /> Default</span>
            {/if}
          </span>
          <span class="list-meta">{placeLabel(list.placeCount ?? 0)}</span>
        </span>
        <span class="edit-affordance">Edit <ChevronDown size={16} /></span>
      </summary>

      <div class="editor">
        <form method="POST" action="?/save" use:enhance class="edit-form">
          <input type="hidden" name="id" value={list.id} />
          <input type="hidden" name="sortOrder" value={list.sortOrder} />
          <label>
            <span>Name</span>
            <input name="name" value={list.name} required maxlength="80" />
          </label>
          <button type="submit" class="primary-button"><Save size={16} /> Save changes</button>
        </form>

        <div class="editor-footer">
          {#if list.isSystem}
            <p class="system-note">
              <LockKeyhole size={15} />
              New and imported places fall back to this list. You can rename it, but it can’t be deleted.
            </p>
          {:else}
            <details class="danger-disclosure">
              <summary><Trash2 size={15} /> Delete list</summary>
              <div class="danger-content">
                <p>{placeLabel(list.placeCount ?? 0)} will be moved before this list is deleted.</p>
                <form method="POST" action="?/delete" use:enhance>
                  <input type="hidden" name="id" value={list.id} />
                  <label>
                    <span>Move places to</span>
                    <select name="replacementId" required>
                      {#each data.lists.filter((item) => item.id !== list.id) as replacement (replacement.id)}
                        <option value={replacement.id}>{replacement.name}</option>
                      {/each}
                    </select>
                  </label>
                  <button type="submit" class="delete-button">
                    <Trash2 size={15} /> Delete {list.name}
                  </button>
                </form>
              </div>
            </details>
          {/if}
        </div>
      </div>
    </details>
  {/each}
</section>

<style>
  .page-heading,
  .heading-actions,
  .overview,
  .create-card,
  .create-form,
  summary,
  .list-name,
  .edit-form,
  .system-note,
  .danger-content form,
  .notice {
    display: flex;
    align-items: center;
  }
  .page-heading {
    justify-content: space-between;
    gap: 2rem;
    margin-bottom: 1.5rem;
  }
  h1 {
    margin: 0;
    font-size: clamp(1.7rem, 3vw, 2.15rem);
    letter-spacing: -0.035em;
  }
  .heading-actions {
    gap: 1.25rem;
  }
  .overview {
    gap: 1.2rem;
  }
  .overview div {
    display: grid;
    gap: 0.05rem;
  }
  .overview strong {
    line-height: 1;
  }
  .overview span,
  label span {
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
    padding: 0.6rem 0.85rem;
    background: var(--accent-bg);
    color: var(--accent-text);
    white-space: nowrap;
  }
  .notice {
    gap: 0.55rem;
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
    gap: 0.85rem;
    border: 1px solid color-mix(in srgb, var(--green-700) 38%, var(--line));
    border-radius: 1rem;
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: var(--cream);
    box-shadow: 0 8px 28px var(--shadow-soft);
  }
  .create-form,
  .edit-form {
    flex: 1;
    gap: 0.75rem;
  }
  label {
    flex: 1;
    display: grid;
    gap: 0.3rem;
  }
  input,
  select {
    width: 100%;
    border: 1px solid var(--input-border);
    border-radius: 0.58rem;
    padding: 0.65rem 0.7rem;
    background: var(--input-bg);
    color: var(--text);
  }
  .section-heading {
    margin: 1.5rem 0 0.65rem;
  }
  .section-heading h2 {
    margin: 0;
    font-size: 1rem;
  }
  .list-grid {
    display: grid;
    gap: 0.7rem;
  }
  .list-card {
    border: 1px solid var(--line);
    border-radius: 0.9rem;
    overflow: hidden;
    background: var(--cream);
  }
  .list-card > summary {
    gap: 0.8rem;
    min-height: 4.5rem;
    padding: 0.8rem 1rem;
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .list-symbol {
    width: 2.65rem;
    height: 2.65rem;
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 50%;
    background: var(--surface-selected);
    color: var(--green-800);
  }
  .list-summary {
    min-width: 0;
    flex: 1;
    display: grid;
    gap: 0.2rem;
  }
  .list-name {
    gap: 0.4rem;
    font-weight: 800;
  }
  .list-meta {
    color: var(--ink-muted);
    font-size: 0.75rem;
  }
  .system-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    border-radius: 999px;
    padding: 0.2rem 0.4rem;
    background: var(--surface-muted);
    color: var(--text-secondary);
    font-size: 0.65rem;
  }
  .edit-affordance {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--green-800);
    font-size: 0.75rem;
    font-weight: 750;
  }
  .editor {
    border-top: 1px solid var(--line);
    padding: 1rem;
    background: var(--surface-muted);
  }
  .editor-footer {
    margin-top: 0.9rem;
  }
  .system-note {
    gap: 0.4rem;
    margin: 0;
    color: var(--ink-muted);
    font-size: 0.78rem;
  }
  .danger-disclosure > summary {
    gap: 0.35rem;
    color: var(--danger-text);
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: 750;
  }
  .danger-content {
    margin-top: 0.75rem;
    border: 1px solid var(--danger-border);
    border-radius: 0.7rem;
    padding: 0.8rem;
    background: var(--danger-bg);
  }
  .danger-content p {
    margin: 0 0 0.75rem;
    color: var(--danger-text);
    font-size: 0.78rem;
  }
  .danger-content form {
    gap: 0.65rem;
  }
  .delete-button {
    min-height: 2.55rem;
    border-radius: 0.6rem;
    padding: 0.6rem 0.8rem;
    background: var(--danger-text);
    color: white;
  }
  @media (max-width: 650px) {
    .page-heading,
    .create-card,
    .create-form,
    .edit-form,
    .danger-content form {
      align-items: stretch;
      flex-direction: column;
    }
    .page-heading {
      gap: 1rem;
    }
    .heading-actions {
      justify-content: space-between;
    }
    .edit-affordance {
      font-size: 0;
    }
  }
</style>
