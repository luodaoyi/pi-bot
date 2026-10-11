import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '#shared': '/workspace/src/shared',
      '#respire-client': '/workspace/src/respire-client',
      '#respire-extension': '/workspace/src/respire-extension',
      '#daemon': '/workspace/src/daemon',
    },
  },
});
