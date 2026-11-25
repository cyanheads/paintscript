/**
 * @fileoverview Vitest configuration. Tests mirror `src/` under `tests/`.
 * @module vitest.config
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
  },
});
