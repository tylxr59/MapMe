<script lang="ts">
  import { enhance } from '$app/forms';
  import { LockKeyhole, MapPinned } from '@lucide/svelte';
  let { form } = $props();
</script>

<svelte:head><title>Sign in · MapMe</title></svelte:head>

<main class="login-shell">
  <section class="login-card">
    <div class="brand"><MapPinned size={28} /> MapMe</div>
    <h1>Welcome back</h1>
    <p>Your saved places are protected by a shared administrator password.</p>
    <form method="POST" use:enhance>
      <label for="password">Password</label>
      <div class="password-field">
        <LockKeyhole size={18} />
        <input
          id="password"
          name="password"
          type="password"
          required
          autocomplete="current-password"
        />
      </div>
      {#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
      <button type="submit">Sign in</button>
    </form>
  </section>
</main>

<style>
  :global(*) {
    box-sizing: border-box;
  }
  :global(body) {
    margin: 0;
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    background: var(--paper);
    color: var(--text);
  }
  .login-shell {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 1.5rem;
    background:
      radial-gradient(circle at 20% 10%, var(--green-100) 0, transparent 32%), var(--paper);
  }
  .login-card {
    width: min(100%, 25rem);
    background: var(--cream);
    border: 1px solid var(--line);
    border-radius: 1.25rem;
    padding: 2rem;
    box-shadow: 0 24px 60px var(--shadow-panel);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: var(--green-800);
    font-weight: 800;
  }
  h1 {
    margin: 2rem 0 0.5rem;
    font-size: 1.8rem;
  }
  p {
    color: var(--text-secondary);
    line-height: 1.5;
  }
  form {
    display: grid;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }
  label {
    font-size: 0.85rem;
    font-weight: 700;
  }
  .password-field {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid var(--input-border);
    border-radius: 0.7rem;
    padding: 0 0.8rem;
    background: var(--input-bg);
  }
  input {
    width: 100%;
    border: 0;
    outline: 0;
    padding: 0.8rem 0;
    font: inherit;
    background: transparent;
    color: var(--text);
  }
  button {
    border: 0;
    border-radius: 0.7rem;
    padding: 0.8rem;
    background: var(--accent-bg);
    color: var(--accent-text);
    font: inherit;
    font-weight: 750;
    cursor: pointer;
  }
  .error {
    color: var(--danger);
    margin: 0;
    font-size: 0.9rem;
  }
</style>
