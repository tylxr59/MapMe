<script lang="ts">
  import { enhance } from '$app/forms';
  import { ArrowRight, LoaderCircle, LockKeyhole } from '@lucide/svelte';
  import AtlasPanel from '#lib/components/brand/AtlasPanel.svelte';
  let { form } = $props();
  let submitting = $state(false);
</script>

<svelte:head><title>Sign in · MapMe</title></svelte:head>

<main class="auth-shell">
  <AtlasPanel />
  <section class="auth-form">
    <div class="inner">
      <span class="eyebrow">Welcome back</span>
      <h1>Sign in to your map</h1>
      <p>Your saved places are protected by a shared administrator password.</p>
      <form
        method="POST"
        use:enhance={() => {
          submitting = true;
          return async ({ update }) => {
            await update();
            submitting = false;
          };
        }}
      >
        <label for="password">Password</label>
        <div class="password-field" class:invalid={Boolean(form?.message)}>
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
        <button type="submit" disabled={submitting}>
          Sign in
          {#if submitting}<LoaderCircle class="spin" size={18} />{:else}<ArrowRight
              size={18}
            />{/if}
        </button>
      </form>
    </div>
  </section>
</main>

<style>
  .auth-shell {
    min-height: 100dvh;
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(22rem, 1fr);
    background: var(--cream) var(--grain);
  }
  .auth-form {
    display: grid;
    place-items: center;
    padding: 2rem 1.5rem;
  }
  .inner {
    width: min(100%, 24rem);
    animation: rise 480ms var(--ease-out) both;
  }
  .eyebrow {
    color: var(--vermilion);
    font-size: 0.72rem;
    font-weight: 650;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  h1 {
    margin: 0.5rem 0 0.6rem;
    font-family: var(--font-display);
    font-size: 2.3rem;
    font-weight: 560;
    font-variation-settings: 'opsz' 96;
    letter-spacing: -0.012em;
    line-height: 1.05;
  }
  p {
    margin: 0;
    color: var(--text-secondary);
    line-height: 1.55;
  }
  form {
    display: grid;
    gap: 0.6rem;
    margin-top: 2rem;
  }
  label {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-secondary);
  }
  .password-field {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0 0.9rem;
    border: 1px solid var(--input-border);
    border-radius: var(--radius-md);
    background: var(--input-bg);
    color: var(--ink-muted);
    transition:
      border-color 120ms ease,
      box-shadow 120ms ease;
  }
  .password-field:focus-within {
    border-color: var(--brand-text);
    box-shadow: 0 0 0 4px var(--focus-ring);
    color: var(--brand-text);
  }
  .password-field.invalid {
    border-color: var(--danger);
  }
  input {
    width: 100%;
    padding: 0.85rem 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--text);
  }
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 3rem;
    margin-top: 0.6rem;
    border: 0;
    border-radius: var(--radius-md);
    background: var(--brand);
    color: var(--accent-text);
    font-weight: 600;
    box-shadow:
      inset 0 1px 0 #ffffff26,
      0 10px 22px -12px var(--brand);
    transition:
      background 120ms ease,
      transform 160ms var(--ease-spring);
  }
  button:hover {
    background: var(--brand-hover);
  }
  button:hover :global(svg) {
    transform: translateX(2px);
  }
  button :global(svg) {
    transition: transform 160ms ease;
  }
  button:active {
    transform: scale(0.98);
  }
  .error {
    color: var(--danger);
    font-size: 0.86rem;
    font-weight: 500;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
  }
  @media (max-width: 820px) {
    .auth-shell {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr;
    }
    .auth-shell :global(.atlas) {
      min-height: 15rem;
    }
    .auth-shell :global(.atlas .tagline) {
      font-size: 2rem;
    }
    .auth-form {
      place-items: start center;
      padding-top: 2.5rem;
    }
  }
</style>
