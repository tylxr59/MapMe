<script lang="ts">
  import { page } from '$app/state';
  import { ArrowLeft, Database, ListChecks, Settings2, Shapes } from '@lucide/svelte';
  import BrandMark from '#lib/components/brand/BrandMark.svelte';
  let { children } = $props();

  const sections = [
    { href: '/manage/general', label: 'General', hint: 'Address & access', icon: Settings2 },
    { href: '/manage/categories', label: 'Categories', hint: 'Icons & colors', icon: Shapes },
    { href: '/manage/lists', label: 'Lists', hint: 'Group your places', icon: ListChecks },
    { href: '/manage/data', label: 'Data', hint: 'Import, export, backup', icon: Database }
  ];

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
  <header class="rail">
    <div class="rail-top">
      <a href="/" class="back" aria-label="Back to map" title="Back to map"
        ><ArrowLeft size={19} /></a
      >
      <a href="/" class="brand" tabindex="-1">
        <BrandMark size={30} />
        <span class="wordmark">MapMe</span>
      </a>
    </div>
    <span class="rail-label">Settings</span>
    <nav onwheel={scrollNavigation}>
      {#each sections as section (section.href)}
        {@const Icon = section.icon}
        <a
          href={section.href}
          aria-current={page.url.pathname.startsWith(section.href) ? 'page' : undefined}
        >
          <span class="nav-icon"><Icon size={16} /></span>
          <span class="nav-copy">
            <span>{section.label}</span>
            <small>{section.hint}</small>
          </span>
        </a>
      {/each}
    </nav>
  </header>
  <main>{@render children()}</main>
</div>

<style>
  .manage-shell {
    min-height: 100dvh;
    display: grid;
    grid-template-columns: 17rem minmax(0, 1fr);
    background: var(--paper);
  }
  .rail {
    position: sticky;
    top: 0;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 1rem 0.85rem;
    border-right: 1px solid var(--line);
    background: var(--cream) var(--grain);
  }
  .rail-top {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 1.4rem;
  }
  .back {
    width: 2.4rem;
    height: 2.4rem;
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    border-radius: var(--radius-sm);
    color: var(--ink-muted);
    text-decoration: none;
    transition:
      background 120ms ease,
      color 120ms ease;
  }
  .back:hover {
    background: var(--surface-muted);
    color: var(--text);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    color: var(--text);
    text-decoration: none;
  }
  .wordmark {
    font-family: var(--font-display);
    font-size: 1.3rem;
    font-weight: 600;
    font-variation-settings: 'opsz' 72;
    letter-spacing: -0.012em;
  }
  .rail-label {
    padding: 0 0.7rem 0.35rem;
    color: var(--ink-muted);
    font-size: 0.68rem;
    font-weight: 650;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  nav {
    min-width: 0;
    display: grid;
    gap: 0.2rem;
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
    gap: 0.7rem;
    padding: 0.55rem 0.7rem;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    text-decoration: none;
    transition:
      background 120ms ease,
      color 120ms ease;
  }
  nav a:hover {
    background: var(--surface-muted);
    color: var(--text);
  }
  nav a[aria-current='page'] {
    background: var(--surface-raised);
    color: var(--text);
    box-shadow:
      0 0 0 1px var(--line),
      0 4px 12px -6px var(--shadow-panel);
  }
  .nav-icon {
    width: 2rem;
    height: 2rem;
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    border-radius: var(--radius-sm);
    background: var(--surface-muted);
  }
  nav a[aria-current='page'] .nav-icon {
    background: var(--brand);
    color: var(--accent-text);
  }
  .nav-copy {
    display: grid;
    line-height: 1.25;
  }
  .nav-copy span {
    font-size: 0.88rem;
    font-weight: 600;
  }
  .nav-copy small {
    color: var(--ink-muted);
    font-size: 0.72rem;
  }
  main {
    width: min(100% - 3rem, 56rem);
    margin: 0 auto;
    padding: 3rem 0 5rem;
    animation: page-in 320ms var(--ease-out);
  }
  /* Shared typography for every settings page. */
  main :global(h1) {
    margin: 0;
    font-family: var(--font-display);
    font-size: 2.4rem;
    font-weight: 560;
    font-variation-settings: 'opsz' 96;
    letter-spacing: -0.012em;
    line-height: 1.05;
  }
  main :global(h2) {
    letter-spacing: -0.01em;
  }
  @keyframes page-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    main {
      animation: none;
    }
  }

  @media (max-width: 860px) {
    .manage-shell {
      display: block;
    }
    .rail {
      position: sticky;
      z-index: 10;
      height: auto;
      flex-direction: row;
      align-items: center;
      gap: 0.5rem;
      padding: 0.55rem 0.75rem;
      border-right: 0;
      border-bottom: 1px solid var(--line);
      background: var(--header-translucent);
      backdrop-filter: blur(12px) saturate(1.4);
    }
    .rail-top {
      margin: 0;
    }
    .brand,
    .rail-label {
      display: none;
    }
    nav {
      display: flex;
      flex: 1;
      gap: 0.25rem;
      overflow-x: auto;
    }
    nav a {
      gap: 0.45rem;
      padding: 0.4rem 0.75rem 0.4rem 0.4rem;
      border-radius: 999px;
    }
    .nav-icon {
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 50%;
    }
    .nav-copy small {
      display: none;
    }
    .nav-copy span {
      font-size: 0.82rem;
    }
    main {
      width: min(100% - 2rem, 56rem);
      padding: 1.75rem 0 4rem;
    }
    main :global(h1) {
      font-size: 2rem;
    }
  }
</style>
