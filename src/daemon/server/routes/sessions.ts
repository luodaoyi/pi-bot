/**
 * Session management routes (CONTRACT: Agent A)
 *
 * GET/POST /api/bots/:id/sessions
 * GET/PATCH/DELETE /api/bots/:id/sessions/:sid
 * POST /api/bots/:id/sessions/:sid/activate
 * POST /api/bots/:id/sessions/:sid/fork
 */

import type { Hono } from 'hono';
import type { Config } from '../../config.js';
import type { Store } from '../../store/index.js';
import type { SessionPool } from '../../sessions/index.js';
import type { ForkSessionRequest, PatchSessionRequest } from '#shared/index.js';

export function setupSessionRoutes(
  app: Hono,
  store: Store,
  sessionPool: SessionPool,
  _config: Config
) {
  app.get('/api/bots/:id/sessions', async (c) => {
    const bot = await store.getBot(c.req.param('id'));
    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }
    try {
      const sessions = await sessionPool.listBotSessions(bot);
      return c.json({ success: true, data: { sessions } });
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Failed to list sessions' },
        400
      );
    }
  });

  app.post('/api/bots/:id/sessions', async (c) => {
    const bot = await store.getBot(c.req.param('id'));
    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }
    const body = (await c.req.json().catch(() => ({}))) as { name?: string };
    try {
      const session = await sessionPool.createBotSession(bot, body.name);
      return c.json({ success: true, data: { session } }, 201);
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Failed to create session' },
        400
      );
    }
  });

  app.get('/api/bots/:id/sessions/:sid', async (c) => {
    const bot = await store.getBot(c.req.param('id'));
    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }
    try {
      const detail = await sessionPool.getBotSession(bot, c.req.param('sid'));
      return c.json({ success: true, data: detail });
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Session not found' },
        404
      );
    }
  });

  app.patch('/api/bots/:id/sessions/:sid', async (c) => {
    const bot = await store.getBot(c.req.param('id'));
    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }
    const body = (await c.req.json()) as PatchSessionRequest;
    try {
      const session = await sessionPool.patchBotSession(bot, c.req.param('sid'), body);
      return c.json({ success: true, data: { session } });
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Failed to update session' },
        400
      );
    }
  });

  app.post('/api/bots/:id/sessions/:sid/activate', async (c) => {
    const bot = await store.getBot(c.req.param('id'));
    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }
    try {
      const session = await sessionPool.activateBotSession(bot, c.req.param('sid'));
      return c.json({ success: true, data: { session } });
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Failed to activate session' },
        400
      );
    }
  });

  app.post('/api/bots/:id/sessions/:sid/fork', async (c) => {
    const bot = await store.getBot(c.req.param('id'));
    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }
    const body = (await c.req.json()) as ForkSessionRequest;
    if (!body.entryId) {
      return c.json({ success: false, error: 'entryId is required' }, 400);
    }
    try {
      const session = await sessionPool.forkBotSession(bot, c.req.param('sid'), body.entryId);
      return c.json({ success: true, data: { session } }, 201);
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Failed to fork session' },
        400
      );
    }
  });

  app.delete('/api/bots/:id/sessions/:sid', async (c) => {
    const bot = await store.getBot(c.req.param('id'));
    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }
    try {
      await sessionPool.deleteBotSession(bot, c.req.param('sid'));
      return c.json({ success: true, data: { success: true } });
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Failed to delete session' },
        400
      );
    }
  });
}
