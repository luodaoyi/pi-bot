/**
 * pi-bot - Multi-agent daemon with Pi SDK and Respire memory
 * @packageDocumentation
 */

// Export main server function
export { serve } from './daemon/server/index.js';

// Export CLI (for programmatic use)
export { loadConfig, expandHome } from './daemon/config.js';

// Export store
export { createStore } from './daemon/store/index.js';

// Export sessions
export { SessionPool } from './daemon/sessions/pool.js';

// Export team coordinator
export { TeamCoordinator } from './daemon/team/coordinator.js';

// Export group manager
export { GroupManager } from './daemon/groups/manager.js';

// Export scheduler
export { createScheduler } from './daemon/scheduler/index.js';

// Export secrets manager
export { createSecretsManager } from './daemon/secrets/index.js';

// Export usage tracker
export { createUsageTracker } from './daemon/usage/index.js';

// Export feature extensions
export { createFeatureExtensions } from './daemon/extensions/index.js';

// Export Respire client (avoid re-exporting shared types)
export { RespireClient } from './respire-client/index.js';

// Export Respire extension
export { createRespireExtension } from './respire-extension/index.js';
export type { RespireExtensionOptions } from './respire-extension/index.js';
