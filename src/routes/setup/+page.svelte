<script lang="ts">
  import { ArrowRight, Check, Database, LockKeyhole, Network, ShieldCheck } from '@lucide/svelte';
  import AtlasPanel from '$lib/components/brand/AtlasPanel.svelte';

  let { data, form } = $props();
  // svelte-ignore state_referenced_locally
  let authMode = $state(form?.values?.authMode ?? data.authMode);
</script>

<svelte:head><title>Set up MapMe</title></svelte:head>

<main class="setup-shell">
  <AtlasPanel>
    <p class="atlas-tagline">A private atlas<br />for the places<br /><em>you love.</em></p>
  </AtlasPanel>
  <section class="setup-card">
    <header>
      <span class="eyebrow">First-run setup · 2 quick choices</span>
      <h1>Make MapMe yours</h1>
      <p>Your choices stay in the <code>/data</code> volume with the rest of your MapMe data.</p>
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
            ><strong>Local by default</strong>Your places and uploads stay under
            <code>/data</code>.</span
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
      <button type="submit">Finish setup <ArrowRight size={18} /></button>
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
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
    background: var(--cream) var(--grain);
  }
  .setup-shell :global(.atlas) {
    position: sticky;
    top: 0;
    height: 100dvh;
  }
  .atlas-tagline {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(2rem, 3.6vw, 3.2rem);
    font-weight: 450;
    font-variation-settings: 'opsz' 144;
    letter-spacing: -0.012em;
    line-height: 1.02;
  }
  .atlas-tagline em {
    color: #f6b99f;
    font-weight: 400;
  }
  .setup-card {
    width: min(100%, 46rem);
    margin: 0 auto;
    padding: clamp(1.5rem, 5vw, 4rem) clamp(1.25rem, 4vw, 3rem);
    animation: rise 480ms var(--ease-out) both;
  }
  header {
    margin-bottom: 2.25rem;
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
    font-size: clamp(2rem, 5vw, 2.8rem);
    font-weight: 560;
    font-variation-settings: 'opsz' 120;
    letter-spacing: -0.012em;
    line-height: 1.02;
  }
  header p,
  .hint {
    margin: 0;
    color: var(--text-secondary);
    line-height: 1.55;
  }
  code {
    padding: 0.1rem 0.35rem;
    border-radius: var(--radius-xs);
    background: var(--surface-muted);
    font-family: var(--font-mono);
    font-size: 0.85em;
  }
  form {
    display: grid;
    gap: 1.5rem;
  }
  fieldset {
    margin: 0;
    padding: 1.35rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface-raised);
    box-shadow: 0 1px 2px var(--shadow-soft);
  }
  legend {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.45rem;
    color: var(--text);
    font-weight: 650;
  }
  legend :global(svg) {
    color: var(--brand-text);
  }
  .hint {
    margin: 0 0 1rem;
    font-size: 0.86rem;
  }
  label:not(.choices label) {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-bottom: 0.4rem;
    color: var(--text-secondary);
    font-size: 0.8rem;
    font-weight: 600;
  }
  input[type='url'],
  input[type='password'],
  input:not([type]) {
    width: 100%;
    min-height: 2.8rem;
    padding: 0.7rem 0.85rem;
    border: 1px solid var(--input-border);
    border-radius: var(--radius-md);
    background: var(--input-bg);
    outline: 0;
    transition:
      border-color 120ms ease,
      box-shadow 120ms ease;
  }
  input:focus {
    border-color: var(--brand-text);
    box-shadow: 0 0 0 4px var(--focus-ring);
  }
  .choices {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.6rem;
  }
  .choices label {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    min-height: 6.4rem;
    padding: 0.95rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--cream);
    cursor: pointer;
    transition:
      border-color 120ms ease,
      background 120ms ease,
      transform 200ms var(--ease-spring);
  }
  .choices label:hover {
    border-color: var(--line-strong);
    transform: translateY(-1px);
  }
  .choices label.chosen {
    border-color: var(--brand-text);
    background: var(--surface-selected);
    box-shadow: 0 0 0 1px var(--brand-text);
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
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    font-weight: 600;
  }
  .choices em {
    padding: 0.1rem 0.4rem;
    border-radius: 999px;
    background: var(--brand);
    color: var(--accent-text);
    font-size: 0.6rem;
    font-style: normal;
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .choices small {
    color: var(--text-secondary);
    font-size: 0.8rem;
    line-height: 1.4;
  }
  .two-column {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.8rem;
    margin-top: 1rem;
  }
  .included {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    padding: 0.25rem 0.25rem 0;
  }
  .included div {
    display: flex;
    gap: 0.6rem;
    color: var(--brand-text);
  }
  .included div :global(svg) {
    flex: 0 0 auto;
    margin-top: 0.1rem;
  }
  .included span {
    display: grid;
    gap: 0.15rem;
    color: var(--text-secondary);
    font-size: 0.78rem;
    line-height: 1.4;
  }
  .included strong {
    color: var(--text);
    font-size: 0.84rem;
    font-weight: 600;
  }
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 3.2rem;
    border: 0;
    border-radius: var(--radius-md);
    background: var(--brand);
    color: var(--accent-text);
    font-size: 0.98rem;
    font-weight: 600;
    box-shadow:
      inset 0 1px 0 #ffffff26,
      0 12px 24px -12px var(--brand);
    transition:
      background 120ms ease,
      transform 160ms var(--ease-spring);
  }
  button:hover {
    background: var(--brand-hover);
  }
  button:active {
    transform: scale(0.99);
  }
  .error {
    margin: 0;
    padding: 0.75rem 0.9rem;
    border-radius: var(--radius-md);
    background: var(--danger-soft);
    color: var(--danger);
    font-weight: 550;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
  }
  @media (max-width: 960px) {
    .setup-shell {
      grid-template-columns: 1fr;
    }
    .setup-shell :global(.atlas) {
      position: relative;
      height: auto;
      min-height: 14rem;
    }
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
