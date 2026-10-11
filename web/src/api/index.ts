// API client factory
// 生产环境永远走真实 daemon HTTP 客户端；mock 仅用于单测直接 import '@/api/mock'

import { HttpApiClient } from './http';
import type { ApiClient } from './client';

export * from './client';
export * from './http';
export * from './types';

let singleton: ApiClient | null = null;

/**
 * 创建 API 客户端。生产 / 打包 GUI 始终使用 HttpApiClient。
 */
export function createApiClient(): ApiClient {
  if (singleton) {
    return singleton;
  }

  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  singleton = new HttpApiClient(baseUrl);
  return singleton;
}

export const api = createApiClient();
