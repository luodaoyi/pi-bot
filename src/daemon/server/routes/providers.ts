/**
 * Provider 认证路由。响应永不包含 key 原文。
 */
import type { Hono } from 'hono';
import {
  deleteProviderAuth,
  listProviders,
  pollOAuth,
  ProviderHttpError,
  startOAuth,
  storeApiKey,
} from '../../models/providers.js';

type ErrorStatus = 400 | 404 | 500 | 501;

function errorStatus(error: unknown): ErrorStatus {
  if (error instanceof ProviderHttpError) {
    const status = error.status;
    if (status === 400 || status === 404 || status === 500 || status === 501) {
      return status;
    }
  }
  return 500;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function setupProviderRoutes(app: Hono) {
  app.get('/api/providers', async (c) => {
    try {
      const providers = await listProviders();
      return c.json({ success: true, data: { providers } });
    } catch (error) {
      return c.json(
        { success: false, error: errorMessage(error, 'Failed to list providers') },
        errorStatus(error)
      );
    }
  });

  app.put('/api/providers/:id/api-key', async (c) => {
    const providerId = c.req.param('id');
    try {
      const body = (await c.req.json()) as { apiKey?: unknown };
      if (typeof body.apiKey !== 'string') {
        return c.json({ success: false, error: 'apiKey is required' }, 400);
      }
      await storeApiKey(providerId, body.apiKey);
      return c.json({ success: true, data: { configured: true } });
    } catch (error) {
      return c.json(
        { success: false, error: errorMessage(error, 'Failed to store API key') },
        errorStatus(error)
      );
    }
  });

  app.delete('/api/providers/:id/auth', async (c) => {
    const providerId = c.req.param('id');
    try {
      const existed = await deleteProviderAuth(providerId);
      return c.json({ success: true, data: { configured: false, existed } });
    } catch (error) {
      return c.json(
        { success: false, error: errorMessage(error, 'Failed to delete provider auth') },
        errorStatus(error)
      );
    }
  });

  app.post('/api/providers/:id/oauth/start', async (c) => {
    const providerId = c.req.param('id');
    try {
      const data = await startOAuth(providerId);
      return c.json({ success: true, data });
    } catch (error) {
      return c.json(
        { success: false, error: errorMessage(error, 'OAuth start failed') },
        errorStatus(error)
      );
    }
  });

  app.get('/api/providers/:id/oauth/:flowId', (c) => {
    const providerId = c.req.param('id');
    const flowId = c.req.param('flowId');
    try {
      const data = pollOAuth(providerId, flowId);
      return c.json({ success: true, data });
    } catch (error) {
      return c.json(
        { success: false, error: errorMessage(error, 'OAuth poll failed') },
        errorStatus(error)
      );
    }
  });
}
