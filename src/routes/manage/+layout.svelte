<script lang="ts">
  import { page } from '$app/state';
  import { ArrowLeft, Database, ListChecks, Settings2, Shapes } from '@lucide/svelte';
  let { children } = $props();

  function scrollNavigation(event: WheelEvent) {
    const navigation = event.currentTarget as HTMLElement;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

    const maximum = navigation.scrollWidth - navigation.clientWidth;
    const next = Math.max(0, Math.min(maximum, navigation.scrollLeft + event.deltaY));
    if (next === navigation.scrollLeft) return;

    event.preventDefault();
    navigation.scrollLeft = next;
  }
</script>

<div class="manage-shell">
  <header>
    <a href="/" class="back" aria-label="Back to map" title="Back to map"><ArrowLeft size={21} /></a
    >
    <strong>Manage MapMe</strong>
    <nav onwheel={scrollNavigation}>
      <a
        href="/manage/general"
        aria-current={page.url.pathname.startsWith('/manage/general') ? 'page' : undefined}
        ><Settings2 size={16} /> General</a
      >
      <a
        href="/manage/categories"
        aria-current={page.url.pathname.startsWith('/manage/categories') ? 'page' : undefined}
        ><Shapes size={16} /> Categories</a
      >
      <a
        href="/manage/lists"
        aria-current={page.url.pathname.startsWith('/manage/lists') ? 'page' : undefined}
        ><ListChecks size={16} /> Lists</a
      >
      <a
        href="/manage/data"
        aria-current={page.url.pathname.startsWith('/manage/data') ? 'page' : undefined}
        ><Database size={16} /> Data</a
      >
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
    gap: 0.65rem;
    padding: 0.6rem max(1rem, calc((100vw - 1050px) / 2));
    border-bottom: 1px solid var(--line);
    background: var(--cream);
    overflow: hidden;
  }
  .back {
    width: 2.6rem;
    height: 2.6rem;
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 0.7rem;
    color: var(--text-secondary);
    text-decoration: none;
  }
  .back:hover {
    background: var(--surface-muted);
    color: var(--green-800);
  }
  header strong {
    flex: 0 0 auto;
    margin-right: 0.35rem;
  }
  nav {
    min-width: 0;
    display: flex;
    flex: 1;
    justify-content: flex-end;
    gap: 0.25rem;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
  }
  nav::-webkit-scrollbar {
    display: none;
  }
  nav a {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 0.3rem;
    border-radius: 0.5rem;
    padding: 0.55rem 0.65rem;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.78rem;
    font-weight: 700;
  }
  nav a:hover {
    background: var(--surface-muted);
    color: var(--green-800);
  }
  nav a[aria-current='page'] {
    background: var(--surface-selected);
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
    nav {
      justify-content: flex-start;
    }
    main {
      padding-top: 1.2rem;
    }
  }
</style>
