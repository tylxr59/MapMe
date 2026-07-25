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
    background: #f4f1e9;
    color: #17221c;
  }
  .login-shell {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 1.5rem;
    background: radial-gradient(circle at 20% 10%, #dcebdc 0, transparent 32%), #f4f1e9;
  }
  .login-card {
    width: min(100%, 25rem);
    background: #fffdf8;
    border: 1px solid #d9ded7;
    border-radius: 1.25rem;
    padding: 2rem;
    box-shadow: 0 24px 60px #203b2a18;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: #1b5e3c;
    font-weight: 800;
  }
  h1 {
    margin: 2rem 0 0.5rem;
    font-size: 1.8rem;
  }
  p {
    color: #5c665f;
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
    border: 1px solid #b8c2ba;
    border-radius: 0.7rem;
    padding: 0 0.8rem;
    background: white;
  }
  input {
    width: 100%;
    border: 0;
    outline: 0;
    padding: 0.8rem 0;
    font: inherit;
  }
  button {
    border: 0;
    border-radius: 0.7rem;
    padding: 0.8rem;
    background: #1b5e3c;
    color: white;
    font: inherit;
    font-weight: 750;
    cursor: pointer;
  }
  .error {
    color: #a32121;
    margin: 0;
    font-size: 0.9rem;
  }
</style>
