/**
 * Usage and cost accounting routes
 * TO BE IMPLEMENTED by parallel branch B
 */

import type { Hono } from 'hono';
import type { Config } from '../../config.js';
import type { Store } from '../../store/index.js';

export function setupUsageRoutes(_app: Hono, _store: Store, _config: Config) {
  // TODO: Implement usage routes:
  // - GET /api/usage (get usage stats)
  // - GET /api/usage/:botId (get bot-specific usage)
}
