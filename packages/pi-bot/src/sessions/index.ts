/**
 * Session management exports
 */

export { SessionPool } from './pool.js';
export { readChatHistory, type ChatMessage, type ChatHistory } from './history.js';
export type {
  SessionInfo,
  SessionPoolConfig,
  SessionPoolStats,
  BotSession,
  SessionEvent,
  DeliveryOptions,
} from './types.js';
