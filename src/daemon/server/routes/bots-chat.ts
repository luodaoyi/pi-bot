/**
 * Bot chat routes: 202 accepted + SSE stream, abort, history
 */

import type { Hono } from 'hono';
import type { Config } from '../../config.js';
import type { Store } from '../../store/index.js';
import type { SessionPool } from '../../sessions/index.js';
import type { ChatRequest } from '#shared/index.js';

export function setupBotChatRoutes(
  app: Hono,
  store: Store,
  sessionPool: SessionPool,
  _config: Config
) {
  /**
   * Start a chat turn. Returns 202 immediately; tokens stream via /api/events.
   */
  app.post('/api/bots/:id/chat', async (c) => {
    const botId = c.req.param('id');
    const body = (await c.req.json()) as ChatRequest;
    const message = body.message ?? body.content;

    const bot = await store.getBot(botId);
    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }

    if (!message) {
      return c.json({ success: false, error: 'message is required' }, 400);
    }

    try {
      const accepted = await sessionPool.startChat(bot, message, body.sessionId);
      return c.json({ success: true, data: accepted }, 202);
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send message',
        },
        400
      );
    }
  });

  app.post('/api/bots/:id/abort', async (c) => {
    const botId = c.req.param('id');
    const body = (await c.req.json().catch(() => ({}))) as { sessionId?: string };

    const bot = await store.getBot(botId);
    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }

    try {
      const aborted = await sessionPool.abort(botId, body.sessionId);
      return c.json({ success: true, data: { aborted } });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to abort',
        },
        400
      );
    }
  });

  app.get('/api/bots/:id/history', async (c) => {
    const botId = c.req.param('id');

    const bot = await store.getBot(botId);
    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }

    try {
      const sessions = await sessionPool.listBotSessions(bot);
      const active = sessions.find((s) => s.isActive) ?? sessions[0];
      if (!active) {
        return c.json({ success: true, data: { messages: [] } });
      }
      const detail = await sessionPool.getBotSession(bot, active.id);
      return c.json({
        success: true,
        data: {
          messages: detail.messages,
          sessionId: active.id,
        },
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get history',
        },
        400
      );
    }
  });
}
