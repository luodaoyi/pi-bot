/**
 * Server-Sent Events (SSE) for real-time updates
 */

import type { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { Store } from '../store/index.js';
import type { SessionPool } from '../sessions/index.js';
import type { BotSseEvent, SSEEvent } from '#shared/index.js';
import type { SessionEvent } from '../sessions/types.js';

export function setupSSE(app: Hono, store: Store, sessionPool?: SessionPool) {
  app.get('/api/events', (c) => {
    return streamSSE(c, async (stream) => {
      await stream.writeSSE({
        event: 'connected',
        data: JSON.stringify({
          type: 'system',
          message: 'Connected to pi-bot event stream',
        } as SSEEvent),
      });

      const unsubscribeStore = store.onAny(async (event: SSEEvent) => {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        });
      });

      const onBotEvent = (payload: SessionEvent) => {
        if (payload.type !== 'bot_event') return;
        const event = payload.event as BotSseEvent;
        void stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        });
      };

      sessionPool?.on('bot_event', onBotEvent);

      const heartbeat = setInterval(() => {
        void stream.writeSSE({
          event: 'heartbeat',
          data: JSON.stringify({ timestamp: Date.now() }),
        });
      }, 30000);

      c.req.raw.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsubscribeStore();
        sessionPool?.off('bot_event', onBotEvent);
      });
    });
  });
}
