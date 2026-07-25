<script lang="ts">
  import { enhance } from '$app/forms';
  import { Plus, Trash2 } from '@lucide/svelte';
  import { suggestedCategoryIcons } from '$lib/icons/category-icons';
  let { data, form } = $props();
</script>

<svelte:head><title>Categories · MapMe</title></svelte:head>

<div class="heading">
  <div>
    <span>Organization</span>
    <h1>Categories</h1>
    <p>A place has one primary category, which controls its map marker.</p>
  </div>
</div>
{#if form?.message}<p class="alert" role="alert">{form.message}</p>{/if}

<section class="card new">
  <h2><Plus size={18} /> New category</h2>
  <form method="POST" action="?/save" use:enhance>
    <label>Name <input name="name" required maxlength="80" placeholder="Bookstore" /></label>
    <label
      >Icon
      <select name="iconName">
        {#each suggestedCategoryIcons as icon}<option value={icon}>{icon}</option>{/each}
      </select>
    </label>
    <label>Color <input name="color" type="color" value="#26734C" /></label>
    <label>Sort order <input name="sortOrder" type="number" value="100" /></label>
    <button type="submit">Add category</button>
  </form>
</section>

<section class="category-list">
  {#each data.categories as category}
    <article class="card">
      <form method="POST" action="?/save" use:enhance class="edit-form">
        <input type="hidden" name="id" value={category.id} />
        <span class="icon" style:background={category.color}>{@html category.iconSvg}</span>
        <label>Name <input name="name" value={category.name} required maxlength="80" /></label>
        <label
          >Icon
          <select name="iconName" value={category.iconName}>
            {#each suggestedCategoryIcons as icon}<option value={icon}>{icon}</option>{/each}
          </select>
        </label>
        <label>Color <input name="color" type="color" value={category.color} /></label>
        <label>Order <input name="sortOrder" type="number" value={category.sortOrder} /></label>
        <button type="submit">Save</button>
      </form>
      {#if !category.isSystem}
        <form method="POST" action="?/delete" use:enhance class="delete-form">
          <input type="hidden" name="id" value={category.id} />
          <label
            >Before deleting, reassign its places to
            <select name="replacementId" required>
              {#each data.categories.filter((item) => item.id !== category.id) as replacement}
                <option value={replacement.id}>{replacement.name}</option>
              {/each}
            </select>
          </label>
          <button type="submit"><Trash2 size={15} /> Delete</button>
        </form>
      {:else}<small>System fallback category</small>{/if}
    </article>
  {/each}
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
    color: var(--ink-muted);
    margin: 0 0 1.5rem;
  }
  .card {
    border: 1px solid var(--line);
    border-radius: 0.85rem;
    background: var(--cream);
    padding: 1rem;
    box-shadow: 0 4px 18px var(--shadow-soft);
  }
  .new {
    margin-bottom: 1rem;
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0 0 0.8rem;
    font-size: 0.95rem;
  }
  form {
    display: flex;
    align-items: end;
    gap: 0.7rem;
    flex-wrap: wrap;
  }
  label {
    display: grid;
    gap: 0.25rem;
    color: var(--text-secondary);
    font-size: 0.7rem;
    font-weight: 750;
  }
  input,
  select {
    min-height: 2.35rem;
    border: 1px solid var(--input-border);
    border-radius: 0.5rem;
    padding: 0.45rem 0.55rem;
    background: var(--input-bg);
    color: var(--text);
  }
  input[type='color'] {
    width: 3.5rem;
    padding: 0.2rem;
  }
  button {
    min-height: 2.35rem;
    border: 0;
    border-radius: 0.5rem;
    background: var(--accent-bg);
    color: var(--accent-text);
    padding: 0.5rem 0.75rem;
    font-weight: 750;
  }
  .category-list {
    display: grid;
    gap: 0.7rem;
  }
  .edit-form {
    display: grid;
    grid-template-columns: auto 1.4fr 1.2fr auto 90px auto;
    align-items: end;
  }
  .icon {
    width: 2.4rem;
    height: 2.4rem;
    display: grid;
    place-items: center;
    border-radius: 0.65rem;
    color: white;
  }
  .delete-form {
    justify-content: flex-end;
    border-top: 1px solid var(--line);
    margin-top: 0.8rem;
    padding-top: 0.7rem;
  }
  .delete-form button {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    background: var(--danger-soft);
    color: var(--danger);
  }
  small {
    display: block;
    margin-top: 0.6rem;
    color: var(--ink-muted);
  }
  .alert {
    padding: 0.7rem;
    border-radius: 0.5rem;
    background: var(--danger-bg);
    color: var(--danger-text);
  }
  @media (max-width: 800px) {
    .edit-form {
      display: flex;
    }
  }
</style>
