<script lang="ts">
  import type { Snippet } from 'svelte';
  import BrandMark from './BrandMark.svelte';

  let { children }: { children?: Snippet } = $props();

  const pins = [
    { x: 20, y: 18, color: '#E76F51', delay: 0 },
    { x: 61, y: 24, color: '#2A9D8F', delay: 120 },
    { x: 40, y: 38, color: '#F4A261', delay: 240 },
    { x: 80, y: 46, color: '#457B9D', delay: 360 },
    { x: 86, y: 12, color: '#8E7DBE', delay: 480 }
  ];
</script>

<aside class="atlas" aria-hidden="true">
  <svg class="contours" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">
    <g fill="none" stroke="currentColor" stroke-width="1.2">
      {#each Array.from({ length: 14 }, (_, index) => index) as ring (ring)}
        <ellipse
          cx="380"
          cy="260"
          rx={30 + ring * 34}
          ry={18 + ring * 22}
          transform="rotate(-18 380 260)"
        />
      {/each}
      {#each Array.from({ length: 9 }, (_, index) => index) as ring (ring)}
        <ellipse
          cx="120"
          cy="640"
          rx={24 + ring * 30}
          ry={16 + ring * 20}
          transform="rotate(24 120 640)"
        />
      {/each}
    </g>
    <path
      d="M600 720 C 540 620, 470 540, 450 440 S 400 310, 380 260"
      fill="none"
      stroke="#E0532B"
      stroke-width="2.5"
      stroke-dasharray="2 9"
      stroke-linecap="round"
    />
  </svg>
  {#each pins as pin (pin.x)}
    <span
      class="pin"
      style:left={`${pin.x}%`}
      style:top={`${pin.y}%`}
      style:--pin={pin.color}
      style:animation-delay={`${pin.delay}ms`}
    ></span>
  {/each}
  <div class="copy">
    <span class="brand"><BrandMark size={40} /> MapMe</span>
    {#if children}{@render children()}{:else}
      <p class="tagline">Every place worth<br /><em>remembering.</em></p>
    {/if}
  </div>
</aside>

<style>
  .atlas {
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: flex-end;
    padding: clamp(2rem, 5vw, 3.5rem);
    background:
      radial-gradient(90% 70% at 70% 30%, #2b6a50 0%, transparent 70%),
      linear-gradient(160deg, #1e4d3b, #10291f);
    color: #f6f3ea;
  }
  .contours {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    color: #f6f3ea1f;
  }
  .pin {
    position: absolute;
    width: 26px;
    height: 26px;
    border: 2.5px solid #fffdf8;
    border-radius: 50% 50% 50% 3px;
    background: var(--pin);
    box-shadow: -3px 8px 14px -4px #00000080;
    transform: rotate(-45deg);
    animation: drop 700ms var(--ease-spring) both;
  }
  .pin::after {
    content: '';
    position: absolute;
    inset: 6px;
    border-radius: 50%;
    background: #fffdf8;
  }
  .copy {
    position: relative;
    display: grid;
    gap: 1.25rem;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    font-family: var(--font-display);
    font-size: 1.6rem;
    font-weight: 600;
    font-variation-settings: 'opsz' 72;
    letter-spacing: -0.012em;
  }
  .brand :global(.brand-mark) {
    filter: none;
  }
  .brand :global(.brand-mark rect) {
    fill: #f6f3ea1f;
  }
  .tagline {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(2.2rem, 4.2vw, 3.6rem);
    font-weight: 450;
    font-variation-settings: 'opsz' 144;
    letter-spacing: -0.012em;
    line-height: 1;
  }
  .tagline em {
    color: #f6b99f;
    font-style: italic;
    font-weight: 400;
  }
  @media (max-width: 820px) {
    .pin,
    .contours path {
      display: none;
    }
  }
  @keyframes drop {
    from {
      opacity: 0;
      transform: translateY(-30px) rotate(-45deg) scale(0.6);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pin {
      animation: none;
    }
  }
</style>
