/**
 * Bot chat routes: Send messages, stream responses
 */

import type { Hono } from 'hono';
import { stream } from 'hono/streaming';
import type { Config } from '../../config.js';
import type { Store } from '../../store/index.js';
import type { SessionPool } from '../../sessions/index.js';
import type { SendMessageRequest } from '#shared/index.js';

export function setupBotChatRoutes(
  app: Hono,
  store: Store,
  sessionPool: SessionPool,
  _config: Config
) {
  /**
   * Send message to a bot and get streaming response
   */
  app.post('/api/bots/:id/chat', async (c) => {
    const botId = c.req.param('id');
    const body = (await c.req.json()) as SendMessageRequest;

    const bot = await store.getBot(botId);
    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }

    try {
      // Send message to bot session
      await sessionPool.sendMessage(botId, body.message, bot);

      // Stream response
      return stream(c, async (stream) => {
        const handler = (event: {
          type: string;
          botId: string;
          delta?: string;
          text?: string;
        }) => {
          if (event.botId === botId) {
            if (event.type === 'message_update' && event.delta) {
              void stream.write(
                `data: ${JSON.stringify({ type: 'delta', delta: event.delta })}\n\n`
              );
            } else if (event.type === 'message_end') {
              void stream.write(
                `data: ${JSON.stringify({ type: 'done', text: event.text })}\n\n`
              );
              void stream.close();
              cleanup();
            }
          }
        };

        const cleanup = () => {
          sessionPool.off('message_update', handler);
          sessionPool.off('message_end', handler);
        };

        sessionPool.on('message_update', handler);
        sessionPool.on('message_end', handler);

        // Cleanup after 5 minutes
        setTimeout(() => {
          cleanup();
          void stream.close();
        }, 5 * 60 * 1000);
      });
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

  /**
   * Abort current bot response
   */
  app.post('/api/bots/:id/abort', async (c) => {
    const botId = c.req.param('id');

    const bot = await store.getBot(botId);
    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }

    try {
      // TODO: Implement abort in session pool
      return c.json({ success: true, data: { aborted: true } });
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

  /**
   * Get chat history for a bot
   */
  app.get('/api/bots/:id/history', async (c) => {
    const botId = c.req.param('id');

    const bot = await store.getBot(botId);
    if (!bot) {
      return c.json({ success: false, error: 'Bot not found' }, 404);
    }

    try {
      // TODO: Read session history from disk
      return c.json({
        success: true,
        data: {
          messages: [],
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
