/**
 * Session management routes (messages, streaming)
 * TO BE IMPLEMENTED by parallel branch A
 */

import type { Hono } from 'hono';
import type { Config } from '../../config.js';
import type { Store } from '../../store/index.js';

export function setupSessionRoutes(_app: Hono, _store: Store, _config: Config) {
  // TODO: Implement session routes:
  // - POST /api/bots/:botId/messages (send message to bot)
  // - GET /api/bots/:botId/messages (get message history)
  // - GET /api/bots/:botId/stream (SSE stream for bot)
}
