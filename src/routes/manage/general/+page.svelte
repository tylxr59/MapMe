<script lang="ts">
  import { enhance } from '$app/forms';
  import { Check, Globe2, LockKeyhole, ShieldCheck } from '@lucide/svelte';
  let { data, form } = $props();
  // svelte-ignore state_referenced_locally
  let authMode = $state(data.authMode);
</script>

<svelte:head><title>General settings · MapMe</title></svelte:head>

<div class="heading">
  <h1>General settings</h1>
</div>

<form method="POST" use:enhance>
  <section class="card">
    <div class="section-heading">
      <Globe2 size={21} />
      <div>
        <h2>Public address</h2>
        <p>Used to validate requests that change your data.</p>
      </div>
    </div>
    <label for="origin">MapMe URL</label>
    <input id="origin" name="origin" type="url" required value={data.origin} />
    {#if data.currentOrigin !== data.origin}
      <p class="notice">
        You opened this page at <code>{data.currentOrigin}</code>. Save that address above if it is
        the one you plan to use.
      </p>
    {/if}
  </section>

  <section class="card">
    <div class="section-heading">
      <ShieldCheck size={21} />
      <div>
        <h2>Access protection</h2>
      </div>
    </div>
    <div class="choices">
      <label class:chosen={authMode === 'password'}>
        <input type="radio" name="authMode" value="password" bind:group={authMode} />
        <span><strong>Password</strong><small>One shared administrator password.</small></span>
      </label>
      <label class:chosen={authMode === 'none'}>
        <input type="radio" name="authMode" value="none" bind:group={authMode} />
        <span><strong>No sign-in</strong><small>For a private, trusted network only.</small></span>
      </label>
      <label class:chosen={authMode === 'proxy'}>
        <input type="radio" name="authMode" value="proxy" bind:group={authMode} />
        <span><strong>Reverse proxy</strong><small>Trust an upstream identity header.</small></span>
      </label>
    </div>

    {#if authMode === 'password'}
      <div class="two-column">
        <div>
          <label for="password"><LockKeyhole size={15} /> New password</label>
          <input
            id="password"
            name="password"
            type="password"
            minlength="8"
            maxlength="1024"
            autocomplete="new-password"
          />
        </div>
        <div>
          <label for="passwordConfirm">Confirm new password</label>
          <input
            id="passwordConfirm"
            name="passwordConfirm"
            type="password"
            minlength="8"
            maxlength="1024"
            autocomplete="new-password"
          />
        </div>
      </div>
      <small class="field-note">Leave both blank to keep the current password.</small>
    {:else if authMode === 'proxy'}
      <div class="two-column">
        <div>
          <label for="proxyHeader">Identity header</label>
          <input id="proxyHeader" name="proxyHeader" required value={data.proxyHeader} />
        </div>
        <div>
          <label for="proxyTrustedCidrs">Trusted proxy networks</label>
          <input
            id="proxyTrustedCidrs"
            name="proxyTrustedCidrs"
            required
            value={data.proxyTrustedCidrs}
            placeholder="172.18.0.0/16"
          />
        </div>
      </div>
    {/if}
  </section>

  {#if form?.message}
    <p class:success={form.success} class="message" role="status">{form.message}</p>
  {/if}
  <button type="submit"><Check size={17} /> Save settings</button>
</form>

<style>
  .heading {
    margin-bottom: 1.5rem;
  }
  h1 {
    margin: 0;
  }
  .section-heading p {
    margin: 0;
    color: var(--text-secondary);
  }
  form {
    display: grid;
    gap: 1rem;
    max-width: 48rem;
  }
  .card {
    padding: 1.25rem;
    border: 1px solid var(--line);
    border-radius: 1rem;
    background: var(--cream);
  }
  .section-heading {
    display: flex;
    gap: 0.7rem;
    color: var(--green-800);
    margin-bottom: 1.1rem;
  }
  .section-heading h2 {
    margin: 0 0 0.2rem;
    color: var(--text);
    font-size: 1.05rem;
  }
  .section-heading p {
    font-size: 0.85rem;
  }
  label:not(.choices label) {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-bottom: 0.4rem;
    font-size: 0.82rem;
    font-weight: 750;
  }
  input[type='url'],
  input[type='password'],
  input:not([type]) {
    width: 100%;
    min-height: 2.7rem;
    padding: 0.65rem 0.75rem;
    border: 1px solid var(--input-border);
    border-radius: 0.65rem;
    background: var(--input-bg);
  }
  input:focus {
    outline: 3px solid var(--focus-ring);
    border-color: var(--green-700);
  }
  .choices {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.6rem;
  }
  .choices label {
    display: flex;
    gap: 0.55rem;
    padding: 0.8rem;
    border: 1px solid var(--line);
    border-radius: 0.75rem;
    background: var(--surface-raised);
    cursor: pointer;
  }
  .choices label.chosen {
    border-color: var(--green-700);
    background: var(--surface-selected);
  }
  .choices input {
    margin-top: 0.2rem;
  }
  .choices span {
    display: grid;
    gap: 0.2rem;
  }
  .choices small,
  .field-note {
    color: var(--text-secondary);
    line-height: 1.35;
  }
  .two-column {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.8rem;
    margin-top: 1rem;
  }
  .field-note {
    display: block;
    margin-top: 0.5rem;
  }
  .notice {
    margin: 0.65rem 0 0;
    padding: 0.65rem;
    border-radius: 0.6rem;
    background: var(--warning-bg);
    color: var(--warning-text);
    font-size: 0.82rem;
  }
  code {
    overflow-wrap: anywhere;
  }
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    width: fit-content;
    min-height: 2.75rem;
    padding: 0 1.1rem;
    border: 0;
    border-radius: 0.7rem;
    background: var(--accent-bg);
    color: var(--accent-text);
    font-weight: 800;
  }
  .message {
    margin: 0;
    color: var(--danger);
    font-weight: 700;
  }
  .message.success {
    color: var(--success-text);
  }
  @media (max-width: 650px) {
    .choices,
    .two-column {
      grid-template-columns: 1fr;
    }
  }
</style>
