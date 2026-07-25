<script lang="ts">
  import { ArrowLeft, Database, Shapes, Tags } from '@lucide/svelte';
  let { children } = $props();
</script>

<div class="manage-shell">
  <header>
    <a href="/" class="back"><ArrowLeft size={18} /> Back to map</a>
    <strong>Manage MapMe</strong>
    <nav>
      <a href="/manage/categories"><Shapes size={16} /> Categories</a>
      <a href="/manage/tags"><Tags size={16} /> Tags</a>
      <a href="/manage/data"><Database size={16} /> Data</a>
    </nav>
  </header>
  <main>{@render children()}</main>
</div>

<style>
  .manage-shell {
    min-height: 100dvh;
    background: var(--paper);
  }
  header {
    min-height: 3.8rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.6rem max(1rem, calc((100vw - 1050px) / 2));
    border-bottom: 1px solid var(--line);
    background: var(--cream);
  }
  .back {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--green-800);
    text-decoration: none;
    font-size: 0.8rem;
    font-weight: 750;
  }
  header strong {
    margin-right: auto;
  }
  nav {
    display: flex;
    gap: 0.25rem;
  }
  nav a {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    border-radius: 0.5rem;
    padding: 0.55rem 0.65rem;
    color: #59645d;
    text-decoration: none;
    font-size: 0.78rem;
    font-weight: 700;
  }
  nav a:hover {
    background: #e9efe9;
    color: var(--green-800);
  }
  main {
    width: min(100% - 2rem, 1050px);
    margin: 0 auto;
    padding: 2rem 0 4rem;
  }
  @media (max-width: 650px) {
    header strong {
      display: none;
    }
    header {
      flex-wrap: wrap;
    }
    nav {
      width: 100%;
      order: 3;
    }
    main {
      padding-top: 1.2rem;
    }
  }
</style>
