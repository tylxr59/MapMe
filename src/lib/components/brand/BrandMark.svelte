<script lang="ts">
  let { size = 32 }: { size?: number } = $props();
</script>

<svg
  class="brand-mark"
  width={size}
  height={size}
  viewBox="0 0 64 64"
  aria-hidden="true"
  focusable="false"
>
  <rect x="2" y="2" width="60" height="60" rx="17" fill="var(--brand)" />
  <g fill="none" stroke="#f6f3ea" stroke-linecap="round" stroke-linejoin="round" opacity="0.22">
    <path d="M6 44c9-6 17-4 25 0s17 5 27-2" stroke-width="1.6" />
    <path d="M6 52c9-5 18-3 26 1s16 4 26-1" stroke-width="1.6" />
  </g>
  <path
    d="M32 12.5c-7.2 0-13 5.6-13 12.6 0 8.6 9.6 17.6 11.9 19.6a1.7 1.7 0 0 0 2.2 0C35.4 42.7 45 33.7 45 25.1c0-7-5.8-12.6-13-12.6Z"
    fill="#f6f3ea"
  />
  <circle cx="32" cy="25" r="4.6" fill="var(--vermilion)" />
</svg>

<style>
  .brand-mark {
    flex: 0 0 auto;
    display: block;
    filter: drop-shadow(0 2px 4px color-mix(in srgb, var(--brand) 35%, transparent));
  }
</style>
