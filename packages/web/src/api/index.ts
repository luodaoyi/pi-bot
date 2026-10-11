// API client factory
// Exports the appropriate client based on environment

import { MockApiClient } from './mock';
import { HttpApiClient } from './http';
import type { ApiClient } from './client';

export * from './client';
export * from './mock';
export * from './http';

/**
 * Create API client instance
 * Uses mock by default for development, can be overridden with env var
 */
export function createApiClient(): ApiClient {
  const useMock = import.meta.env.VITE_USE_MOCK_API !== 'false';
  const baseUrl = import.meta.env.VITE_API_BASE_URL;

  if (useMock) {
    console.log('[API] Using mock client for development');
    return new MockApiClient();
  }

  console.log(`[API] Using HTTP client (${baseUrl || 'http://127.0.0.1:8787'})`);
  return new HttpApiClient(baseUrl);
}
