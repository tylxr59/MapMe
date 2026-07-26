import eslint from '@eslint/js';
import globals from 'globals';
import svelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['build/', '.svelte-kit/', 'coverage/', 'node_modules/'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser
      }
    },
    rules: {
      'svelte/no-navigation-without-resolve': 'off',
      'svelte/require-each-key': 'error'
    }
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    files: [
      'src/lib/components/categories/CategoryIconPicker.svelte',
      'src/lib/components/places/PlaceDetails.svelte',
      'src/lib/components/places/PlaceListItem.svelte',
      'src/routes/manage/categories/+page.svelte'
    ],
    rules: {
      // These values are generated exclusively from packaged, allow-listed Lucide icon nodes.
      'svelte/no-at-html-tags': 'off'
    }
  }
);
