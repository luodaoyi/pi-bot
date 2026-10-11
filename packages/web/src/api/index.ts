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
 * Uses HTTP client by default, mock only when VITE_USE_MOCK_API=true
 */
export function createApiClient(): ApiClient {
  // @ts-expect-error - Vite env types
  const useMock = import.meta.env?.VITE_USE_MOCK_API === 'true';
  // @ts-expect-error - Vite env types
  const baseUrl = import.meta.env?.VITE_API_BASE_URL;

  if (useMock) {
    console.log('[API] Using mock client for development');
    return new MockApiClient();
  }

  console.log(`[API] Using HTTP client (${baseUrl || 'http://127.0.0.1:8787'})`);
  return new HttpApiClient(baseUrl);
}
