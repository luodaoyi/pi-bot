import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts', 'web/src/**/*.test.ts'],
    environmentMatchGlobs: [
      ['web/src/**/*.test.ts', 'jsdom'],
    ],
  },
  resolve: {
    alias: {
      '#shared': '/workspace/src/shared',
      '#respire-client': '/workspace/src/respire-client',
      '#respire-extension': '/workspace/src/respire-extension',
      '#daemon': '/workspace/src/daemon',
      '@': path.resolve(__dirname, './web/src'),
    },
  },
});
