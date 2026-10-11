/**
 * Bot management routes
 */

import type { Hono } from 'hono';
import type { Config } from '../../config.js';
import type { Store } from '../../store/index.js';
import type { BotCreateRequest, BotUpdateRequest } from '@pi-bot/shared';

export function setupBotRoutes(app: Hono, store: Store, _config: Config) {
  // List all bots
  app.get('/api/bots', async (c) => {
    const bots = await store.listBots();
    return c.json({ success: true, data: { bots } });
  });

  // Get bot by ID
  app.get('/api/bots/:id', async (c) => {
    const id = c.req.param('id');
    const bot = await store.getBot(id);

    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }

    return c.json({ success: true, data: { bot } });
  });

  // Create bot
  app.post('/api/bots', async (c) => {
    const body = (await c.req.json()) as BotCreateRequest;

    try {
      const bot = await store.createBot(body);
      return c.json({ success: true, data: { bot } }, 201);
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create bot',
        },
        400
      );
    }
  });

  // Update bot
  app.patch('/api/bots/:id', async (c) => {
    const id = c.req.param('id');
    const body = (await c.req.json()) as BotUpdateRequest;

    try {
      const bot = await store.updateBot(id, body);
      return c.json({ success: true, data: { bot } });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update bot',
        },
        400
      );
    }
  });

  // Delete bot
  app.delete('/api/bots/:id', async (c) => {
    const id = c.req.param('id');

    try {
      await store.deleteBot(id);
      return c.json({ success: true, data: { success: true } });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete bot',
        },
        400
      );
    }
  });
}
