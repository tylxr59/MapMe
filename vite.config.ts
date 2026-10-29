import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    sveltekit({
      preprocess: vitePreprocess(),
      adapter: adapter({ precompress: true }),
      csrf: {
        // MapMe's public address is configured at runtime (first-run setup), so it
        // cannot be baked into paths.origin, and adapter-node assumes https unless a
        // PROTOCOL_HEADER is set. hooks.server.ts performs the equivalent origin check
        // against the persisted public address instead.
        trustedOrigins: ['*']
      },
      csp: {
        mode: 'auto',
        directives: {
          'default-src': ['self'],
          'script-src': ['self'],
          'style-src': ['self', 'unsafe-inline'],
          'img-src': ['self', 'data:', 'blob:'],
          'connect-src': ['self'],
          'frame-ancestors': ['none'],
          'base-uri': ['self'],
          'form-action': ['self'],
          'object-src': ['none']
        }
      }
    })
  ],
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    testTimeout: 20_000
  }
});
