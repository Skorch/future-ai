import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    // Default to node environment
    environment: 'node',
    // Use jsdom for specific paths (React hooks/components)
    environmentMatchGlobs: [
      ['**/__tests__/unit/hooks/**/*.test.ts', 'jsdom'],
      ['**/__tests__/unit/sidebar/**/*.test.tsx', 'jsdom'],
      ['**/__tests__/unit/tables/**/*.test.tsx', 'jsdom'],
    ],
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'out', 'build'],
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '__tests__/',
        '*.config.ts',
        '*.config.js',
        '.next/',
        'out/',
        'build/',
        'scripts/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
