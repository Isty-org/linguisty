/** @spec spec://common/PROP-002-quality#checks */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**'],
    environment: 'jsdom',
    maxWorkers: 2,
    restoreMocks: true,
    clearMocks: true,
    testTimeout: 10_000,
  },
});

