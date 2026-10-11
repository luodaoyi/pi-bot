/**
 * Routes index - mounts all feature routes
 * Each feature registers its own routes to avoid merge conflicts
 */

import type { Hono } from 'hono';
import type { Config } from '../../config.js';
import type { Store } from '../../store/index.js';
import { setupBotRoutes } from './bots.js';
import { setupSystemRoutes } from './system.js';
// Placeholder imports for features being built in parallel branches:
// import { setupSessionRoutes } from './sessions.js';
// import { setupTeamRoutes } from './team.js';
// import { setupGroupRoutes } from './groups.js';
// import { setupSchedulerRoutes } from './scheduler.js';
// import { setupSecretsRoutes } from './secrets.js';
// import { setupUsageRoutes } from './usage.js';

export function setupRoutes(app: Hono, store: Store, config: Config) {
  // Core routes
  setupBotRoutes(app, store, config);
  setupSystemRoutes(app, store, config);

  // Feature routes (to be added by parallel branches):
  // setupSessionRoutes(app, store, config);
  // setupTeamRoutes(app, store, config);
  // setupGroupRoutes(app, store, config);
  // setupSchedulerRoutes(app, store, config);
  // setupSecretsRoutes(app, store, config);
  // setupUsageRoutes(app, store, config);
}
