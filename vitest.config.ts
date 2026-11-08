import { defineConfig } from 'vitest/config';

// Unit tests for pure business rules (no D1, no network) — fast and runnable anywhere.
export default defineConfig({
  test: {
    include: ['backend/test/**/*.test.ts'],
    environment: 'node',
  },
});
