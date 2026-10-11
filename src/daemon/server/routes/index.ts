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
import type { Scheduler } from '../../scheduler/index.js';
import type { SecretsManager } from '../../secrets/index.js';
import type { UsageTracker } from '../../usage/index.js';
import { setupBotRoutes } from './bots.js';
import { setupBotChatRoutes } from './bots-chat.js';
import { setupTeamRoutes } from './team.js';
import { setupGroupRoutes } from './groups.js';
import { setupSystemRoutes } from './system.js';
import { setupTaskRoutes } from './tasks.js';
import { setupSecretRoutes } from './secrets.js';
import { setupUsageRoutes } from './usage.js';

export interface RoutesContext {
  sessionPool?: SessionPool;
  teamCoordinator?: TeamCoordinator;
  groupManager?: GroupManager;
  scheduler?: Scheduler;
  secrets?: SecretsManager;
  usage?: UsageTracker;
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

  // Scheduler routes
  if (context?.scheduler) {
    setupTaskRoutes(app, context.scheduler);
  }

  // Secrets management routes
  if (context?.secrets) {
    setupSecretRoutes(app, context.secrets);
  }

  // Usage tracking routes
  if (context?.usage) {
    setupUsageRoutes(app, context.usage);
  }
}
