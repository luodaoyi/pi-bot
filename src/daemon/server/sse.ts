/**
 * Server-Sent Events (SSE) for real-time updates
 */

import type { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { Store } from '../store/index.js';
import type { SSEEvent } from '#shared/index.js';

export function setupSSE(app: Hono, store: Store) {
  app.get('/api/events', (c) => {
    return streamSSE(c, async (stream) => {
      // Send initial connection message
      await stream.writeSSE({
        event: 'connected',
        data: JSON.stringify({
          type: 'system',
          message: 'Connected to pi-bot event stream',
        } as SSEEvent),
      });

      // Subscribe to store events
      const unsubscribe = store.onAny(async (event: SSEEvent) => {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        });
      });

      // Keep connection alive with heartbeat
      const heartbeat = setInterval(async () => {
        await stream.writeSSE({
          event: 'heartbeat',
          data: JSON.stringify({ timestamp: Date.now() }),
        });
      }, 30000);

      // Cleanup on disconnect
      c.req.raw.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    });
  });
}
