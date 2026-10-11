/**
 * Secrets management routes
 * TO BE IMPLEMENTED by parallel branch B
 */

import type { Hono } from 'hono';
import type { Config } from '../../config.js';
import type { Store } from '../../store/index.js';

export function setupSecretsRoutes(_app: Hono, _store: Store, _config: Config) {
  // TODO: Implement secrets routes:
  // - GET /api/secrets (list secrets, no values)
  // - POST /api/secrets (create secret)
  // - POST /api/secrets/:name/revoke (revoke secret from bot)
}
