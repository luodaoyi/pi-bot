/**
 * Session management exports
 */

export { SessionPool } from './pool.js';
export { getSharedAgentServices, resetSharedAgentServices, servicesForCwd } from './services.js';
export type {
  SessionInfo,
  SessionPoolConfig,
  SessionPoolStats,
  BotSession,
  SessionEvent,
  DeliveryOptions,
} from './types.js';
