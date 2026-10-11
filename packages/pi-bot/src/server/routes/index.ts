/**
 * Routes index - mounts all feature routes
 * Each feature registers its own routes to avoid merge conflicts
 */

import type { Hono } from 'hono';
import type { Config } from '../../config.js';
import type { Store } from '../../store/index.js';
import type { SessionPool } from '../../sessions/index.js';
import type { TeamCoordinator } from '../../team/index.js';
import type { GroupManager } from '../../groups/index.js';
import { setupBotRoutes } from './bots.js';
import { setupBotChatRoutes } from './bots-chat.js';
import { setupTeamRoutes } from './team.js';
import { setupGroupRoutes } from './groups.js';
import { setupSystemRoutes } from './system.js';

export interface RoutesContext {
  sessionPool?: SessionPool;
  teamCoordinator?: TeamCoordinator;
  groupManager?: GroupManager;
}

export function setupRoutes(
  app: Hono,
  store: Store,
  config: Config,
  context?: RoutesContext
) {
  // Core routes
  setupBotRoutes(app, store, config);
  setupSystemRoutes(app, store, config);

  // Session and chat routes
  if (context?.sessionPool) {
    setupBotChatRoutes(app, store, context.sessionPool, config);
  }

  // Team coordination routes
  if (context?.teamCoordinator) {
    setupTeamRoutes(app, store, context.teamCoordinator, config);
  }

  // Group chat routes
  if (context?.groupManager) {
    setupGroupRoutes(app, store, context.groupManager, config);
  }

  // Future feature routes (to be added by parallel branches):
  // setupSchedulerRoutes(app, store, config);
  // setupSecretsRoutes(app, store, config);
  // setupUsageRoutes(app, store, config);
}
