<script lang="ts">
  import { enhance } from '$app/forms';
  import { Merge, Plus, Trash2 } from '@lucide/svelte';
  let { data, form } = $props();
</script>

<svelte:head><title>Tags · MapMe</title></svelte:head>
<div class="heading">
  <span>Organization</span>
  <h1>Tags</h1>
  <p>Use tags as flexible secondary labels and filters.</p>
</div>
{#if form?.message}<p class="alert" role="alert">{form.message}</p>{/if}

<div class="grid">
  <section class="card">
    <h2><Plus size={18} /> New tag</h2>
    <form method="POST" action="?/save" use:enhance>
      <input
        name="name"
        maxlength="80"
        required
        placeholder="Great for groups"
        aria-label="Tag name"
      />
      <button>Add tag</button>
    </form>
  </section>
  <section class="card">
    <h2><Merge size={18} /> Merge tags</h2>
    <form method="POST" action="?/merge" use:enhance>
      <select name="sourceId" required aria-label="Tag to merge">
        <option value="">Merge…</option>
        {#each data.tags as tag}<option value={tag.id}>{tag.name}</option>{/each}
      </select>
      <select name="targetId" required aria-label="Target tag">
        <option value="">Into…</option>
        {#each data.tags as tag}<option value={tag.id}>{tag.name}</option>{/each}
      </select>
      <button>Merge</button>
    </form>
  </section>
</div>

<section class="card tags">
  {#if data.tags.length}
    {#each data.tags as tag}
      <div class="tag-row">
        <form method="POST" action="?/save" use:enhance>
          <input type="hidden" name="id" value={tag.id} />
          <input name="name" maxlength="80" required value={tag.name} aria-label="Tag name" />
          <span>{tag.placeCount} places</span>
          <button>Save</button>
        </form>
        <form method="POST" action="?/delete" use:enhance>
          <input type="hidden" name="id" value={tag.id} />
          <button class="delete" aria-label={`Delete ${tag.name}`}><Trash2 size={15} /></button>
        </form>
      </div>
    {/each}
  {:else}<p>No tags yet.</p>{/if}
</section>

<style>
  .heading span {
    color: var(--green-700);
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  h1 {
    margin: 0.2rem 0;
  }
  .heading p {
    margin: 0 0 1.5rem;
    color: var(--ink-muted);
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .card {
    border: 1px solid var(--line);
    border-radius: 0.85rem;
    background: var(--cream);
    padding: 1rem;
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0 0 0.7rem;
    font-size: 0.95rem;
  }
  form {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  input,
  select {
    min-width: 0;
    flex: 1;
    border: 1px solid #c9d2ca;
    border-radius: 0.5rem;
    padding: 0.6rem;
    background: white;
  }
  button {
    border: 0;
    border-radius: 0.5rem;
    background: var(--green-800);
    color: white;
    padding: 0.6rem 0.75rem;
    font-weight: 750;
  }
  .tag-row {
    display: flex;
    gap: 0.4rem;
    border-bottom: 1px solid var(--line);
    padding: 0.55rem 0;
  }
  .tag-row:last-child {
    border-bottom: 0;
  }
  .tag-row > form:first-child {
    flex: 1;
  }
  .tag-row span {
    color: var(--ink-muted);
    font-size: 0.75rem;
    white-space: nowrap;
  }
  .delete {
    background: #f1e7e4;
    color: var(--danger);
  }
  .alert {
    padding: 0.7rem;
    border-radius: 0.5rem;
    background: #f7dfdb;
    color: #7e2820;
  }
  @media (max-width: 650px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
