/**
 * GET /api/models — pi SDK 模型目录 + settings.json 默认模型
 * GET /api/system/models 作为别名
 */
import type { Context, Hono } from 'hono';
import { listCatalog } from '../../models/catalog.js';

export async function handleGetModels(c: Context) {
  try {
    const data = await listCatalog();
    return c.json({ success: true, data });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load models from pi SDK',
      },
      500
    );
  }
}

export function setupModelRoutes(app: Hono) {
  app.get('/api/models', handleGetModels);
}
