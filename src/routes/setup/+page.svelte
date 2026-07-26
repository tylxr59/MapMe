<script lang="ts">
  import { Check, Database, LockKeyhole, MapPinned, Network, ShieldCheck } from '@lucide/svelte';

  let { data, form } = $props();
  // svelte-ignore state_referenced_locally
  let authMode = $state(form?.values?.authMode ?? data.authMode);
</script>

<svelte:head><title>Set up MapMe</title></svelte:head>

<main class="setup-shell">
  <section class="setup-card">
    <header>
      <span class="brand-icon"><MapPinned size={26} /></span>
      <div>
        <span class="eyebrow">First-run setup</span>
        <h1>Make MapMe yours</h1>
        <p>Your choices stay in the `/data` volume with the rest of your MapMe data.</p>
      </div>
    </header>

    <form method="POST">
      <fieldset>
        <legend><Network size={19} /> How you reach MapMe</legend>
        <p class="hint">
          This was detected from your browser. Change it if you will use a reverse proxy or a
          different address.
        </p>
        <label for="origin">Public address</label>
        <input
          id="origin"
          name="origin"
          type="url"
          required
          value={form?.values?.origin ?? data.origin}
          placeholder="https://map.example.com"
          autocomplete="url"
        />
      </fieldset>

      <fieldset>
        <legend><ShieldCheck size={19} /> Access protection</legend>
        <div class="choices">
          <label class:chosen={authMode === 'password'}>
            <input type="radio" name="authMode" value="password" bind:group={authMode} />
            <span>
              <strong>Password <em>Recommended</em></strong>
              <small>Protect MapMe with one shared administrator password.</small>
            </span>
          </label>
          <label class:chosen={authMode === 'none'}>
            <input type="radio" name="authMode" value="none" bind:group={authMode} />
            <span>
              <strong>No sign-in</strong>
              <small>Only use this on a private, trusted network.</small>
            </span>
          </label>
          <label class:chosen={authMode === 'proxy'}>
            <input type="radio" name="authMode" value="proxy" bind:group={authMode} />
            <span>
              <strong>Reverse proxy</strong>
              <small>Trust an identity header from specific proxy networks.</small>
            </span>
          </label>
        </div>

        {#if authMode === 'password'}
          <div class="two-column">
            <div>
              <label for="password"><LockKeyhole size={15} /> Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minlength="8"
                maxlength="1024"
                autocomplete="new-password"
              />
            </div>
            <div>
              <label for="passwordConfirm">Confirm password</label>
              <input
                id="passwordConfirm"
                name="passwordConfirm"
                type="password"
                required
                minlength="8"
                maxlength="1024"
                autocomplete="new-password"
              />
            </div>
          </div>
        {:else if authMode === 'proxy'}
          <div class="two-column">
            <div>
              <label for="proxyHeader">Identity header</label>
              <input
                id="proxyHeader"
                name="proxyHeader"
                required
                value={form?.values?.proxyHeader ?? data.proxyHeader}
                placeholder="Remote-User"
              />
            </div>
            <div>
              <label for="proxyTrustedCidrs">Trusted proxy networks</label>
              <input
                id="proxyTrustedCidrs"
                name="proxyTrustedCidrs"
                required
                value={form?.values?.proxyTrustedCidrs ?? data.proxyTrustedCidrs}
                placeholder="172.18.0.0/16"
              />
            </div>
          </div>
        {/if}
      </fieldset>

      <section class="included">
        <div>
          <Database size={18} /><span
            ><strong>Local by default</strong>Your places and uploads stay under `/data`.</span
          >
        </div>
        <div>
          <Check size={18} /><span
            ><strong>Map included</strong>OSM tiles use MapMe's private caching proxy.</span
          >
        </div>
        <div>
          <Check size={18} /><span
            ><strong>Search included</strong>Address search is ready without an API key.</span
          >
        </div>
      </section>

      {#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
      <button type="submit">Finish setup <Check size={18} /></button>
    </form>
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
  }
  .setup-shell {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: 2rem 1rem;
    background:
      radial-gradient(circle at 12% 8%, var(--green-100), transparent 30%),
      radial-gradient(circle at 90% 92%, var(--surface-selected), transparent 28%), var(--paper);
  }
  .setup-card {
    width: min(100%, 48rem);
    padding: clamp(1.25rem, 4vw, 2.5rem);
    border: 1px solid var(--line);
    border-radius: 1.5rem;
    background: var(--cream);
    box-shadow: 0 24px 70px var(--shadow-panel);
  }
  header {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
    margin-bottom: 2rem;
  }
  .brand-icon {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 3.25rem;
    height: 3.25rem;
    border-radius: 1rem;
    background: var(--accent-bg);
    color: var(--accent-text);
  }
  .eyebrow {
    color: var(--green-700);
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  h1 {
    margin: 0.2rem 0 0.35rem;
    font-size: clamp(1.75rem, 5vw, 2.4rem);
  }
  header p,
  .hint {
    margin: 0;
    color: var(--text-secondary);
    line-height: 1.5;
  }
  form {
    display: grid;
    gap: 1.25rem;
  }
  fieldset {
    margin: 0;
    padding: 1.1rem;
    border: 1px solid var(--line);
    border-radius: 1rem;
  }
  legend {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0 0.4rem;
    color: var(--green-800);
    font-weight: 800;
  }
  .hint {
    margin: 0 0 0.9rem;
    font-size: 0.87rem;
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
    min-height: 2.75rem;
    padding: 0.7rem 0.8rem;
    border: 1px solid var(--input-border);
    border-radius: 0.7rem;
    background: var(--input-bg);
  }
  input:focus {
    outline: 3px solid var(--focus-ring);
    border-color: var(--green-700);
  }
  .choices {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.65rem;
  }
  .choices label {
    display: flex;
    gap: 0.65rem;
    min-height: 6.2rem;
    padding: 0.85rem;
    border: 1px solid var(--line);
    border-radius: 0.8rem;
    background: var(--surface-raised);
    cursor: pointer;
  }
  .choices label.chosen {
    border-color: var(--green-700);
    background: var(--surface-selected);
    box-shadow: 0 0 0 3px var(--focus-ring);
  }
  .choices input {
    margin-top: 0.2rem;
  }
  .choices span {
    display: grid;
    gap: 0.35rem;
    align-content: start;
  }
  .choices strong {
    display: grid;
    gap: 0.2rem;
  }
  .choices em {
    width: fit-content;
    color: var(--green-800);
    font-size: 0.65rem;
    font-style: normal;
    text-transform: uppercase;
  }
  .choices small {
    color: var(--text-secondary);
    line-height: 1.35;
  }
  .two-column {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.8rem;
    margin-top: 0.9rem;
  }
  .included {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.7rem;
  }
  .included div {
    display: flex;
    gap: 0.55rem;
    padding: 0.8rem;
    border-radius: 0.8rem;
    background: var(--surface-muted);
    color: var(--green-800);
  }
  .included span {
    display: grid;
    gap: 0.2rem;
    color: var(--text-secondary);
    font-size: 0.76rem;
    line-height: 1.35;
  }
  .included strong {
    color: var(--text);
    font-size: 0.82rem;
  }
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    min-height: 3rem;
    border: 0;
    border-radius: 0.8rem;
    background: var(--accent-bg);
    color: var(--accent-text);
    font-weight: 800;
  }
  .error {
    margin: 0;
    color: var(--danger);
    font-weight: 700;
  }
  @media (max-width: 650px) {
    .choices,
    .included,
    .two-column {
      grid-template-columns: 1fr;
    }
    .choices label {
      min-height: auto;
    }
  }
</style>
