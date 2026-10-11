/**
 * Session pool types
 */

import type { CreateAgentSessionResult, AgentSession } from '@earendil-works/pi-coding-agent';

export interface SessionInfo {
  botId: string;
  sessionId: string;
  created: number;
  lastActive: number;
  status: 'idle' | 'active' | 'settling';
  messageCount: number;
}

export interface SessionPoolConfig {
  maxSessions: number;
  idleTimeoutMs: number;
  sessionDir: string;
}

export interface SessionPoolStats {
  active: number;
  idle: number;
  total: number;
  maxSessions: number;
}

/**
 * Bot session with runtime context
 */
export interface BotSession {
  botId: string;
  result: CreateAgentSessionResult;
  session: AgentSession;
  info: SessionInfo;
}

/**
 * Message delivery options
 */
export interface DeliveryOptions {
  from?: string; // Sender bot ID or 'user'
  replyTo?: 'me' | 'user'; // Route reply back to sender or to user
  hop?: number; // Hop count for cycle detection
}

/**
 * Session event types
 */
export type SessionEvent = 
  | { type: 'session_created'; botId: string }
  | { type: 'session_destroyed'; botId: string }
  | { type: 'session_idle'; botId: string }
  | { type: 'message_start'; botId: string; messageId: string }
  | { type: 'message_update'; botId: string; messageId: string; delta?: string; text?: string }
  | { type: 'message_end'; botId: string; messageId: string; text: string }
  | { type: 'tool_call'; botId: string; tool: string; args: unknown }
  | { type: 'status_change'; botId: string; status: 'idle' | 'active' | 'settling' }
  | { type: 'error'; botId: string; error: string };
