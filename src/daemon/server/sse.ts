/**
 * Server-Sent Events (SSE) for real-time updates.
 * Hono 的 streamSSE 在回调 resolve 后会 close stream，必须挂起直到客户端断开。
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
        if (stream.closed || stream.aborted) return;
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        });
      });

      const onBotEvent = (payload: SessionEvent) => {
        if (payload.type !== 'bot_event') return;
        if (stream.closed || stream.aborted) return;
        const event = payload.event as BotSseEvent;
        void stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        });
      };

      sessionPool?.on('bot_event', onBotEvent);

      const heartbeat = setInterval(() => {
        if (stream.closed || stream.aborted) return;
        void stream.writeSSE({
          event: 'heartbeat',
          data: JSON.stringify({ timestamp: Date.now() }),
        });
      }, 30000);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribeStore();
        sessionPool?.off('bot_event', onBotEvent);
      };

      try {
        await new Promise<void>((resolve) => {
          const done = () => resolve();
          c.req.raw.signal.addEventListener('abort', done, { once: true });
          stream.onAbort(done);
          if (c.req.raw.signal.aborted || stream.aborted || stream.closed) {
            done();
          }
        });
      } finally {
        cleanup();
      }
    });
  });
}
