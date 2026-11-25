/**
 * @fileoverview Vitest configuration. Tests mirror `src/` under `tests/`.
 * @module vitest.config
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Vitest 5.1.1's forks pool can't start workers under Bun 1.4 (`child.channel.unref`
    // is missing); worker threads run under both Bun and Node.
    pool: 'threads',
    testTimeout: 60_000,
  },
});
