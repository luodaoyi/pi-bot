import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts', 'web/src/**/*.test.ts', 'tests/**/*.test.ts'],
    environmentMatchGlobs: [
      ['web/src/**/*.test.ts', 'jsdom'],
      ['tests/ui/**/*.test.ts', 'jsdom'],
    ],
    pool: 'forks',
  },
  resolve: {
    alias: [
      { find: /^#shared\/(.*)$/, replacement: path.resolve(__dirname, './src/shared/$1') },
      { find: /^#shared$/, replacement: path.resolve(__dirname, './src/shared') },
      { find: /^#respire-client\/(.*)$/, replacement: path.resolve(__dirname, './src/respire-client/$1') },
      { find: /^#respire-client$/, replacement: path.resolve(__dirname, './src/respire-client') },
      { find: /^#respire-extension\/(.*)$/, replacement: path.resolve(__dirname, './src/respire-extension/$1') },
      { find: /^#respire-extension$/, replacement: path.resolve(__dirname, './src/respire-extension') },
      { find: /^#daemon\/(.*)$/, replacement: path.resolve(__dirname, './src/daemon/$1') },
      { find: /^#daemon$/, replacement: path.resolve(__dirname, './src/daemon') },
      { find: '@', replacement: path.resolve(__dirname, './web/src') },
    ],
  },
});
