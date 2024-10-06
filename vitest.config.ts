import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: false,
    globals: true,
    coverage: {
      provider: 'v8',
      exclude: ['**/tests/**'],
    },
    env: {
      FOLDER_INVENTORY: 'storage-test-inventory',
    },
  },
  //plugins: [tsconfigPaths()],
});
