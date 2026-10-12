/**
 * Session pool types
 */

import type { CreateAgentSessionResult, AgentSession } from '@earendil-works/pi-coding-agent';
import type {
  BotSseEvent,
  ChatSessionSummary,
  SessionStats,
  ThinkingLevel,
} from '#shared/index.js';
import type { AgentSessionServices, ModelRuntime } from '@earendil-works/pi-coding-agent';
import type { PibotHost } from '../pibot-tools/index.js';

export interface SessionInfo {
  botId: string;
  sessionId: string;
  created: number;
  lastActive: number;
  status: 'idle' | 'active' | 'settling';
  messageCount: number;
  hop: number;
}

export interface SessionPoolConfig {
  maxSessions: number;
  idleTimeoutMs: number;
  sessionDir: string;
  workspaceDir?: string;
  loadUserExtensions?: boolean;
  loadContextFiles?: boolean;
  /** Injected shared services (daemon or tests). Created lazily if omitted. */
  services?: AgentSessionServices;
  modelRuntime?: ModelRuntime;
  agentDir?: string;
  /** 注入 pibot_* 自管理工具（daemon 启动后 setHost） */
  pibotHost?: PibotHost;
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
  sessionId: string;
  result: CreateAgentSessionResult;
  session: AgentSession;
  info: SessionInfo;
  unsubscribe?: () => void;
  runId?: string;
}

/**
 * Message delivery options
 */
export interface DeliveryOptions {
  from?: string; // Sender bot ID or 'user'
  replyTo?: 'me' | 'user'; // Route reply back to sender or to user
  hop?: number; // Hop count for cycle detection
  sessionId?: string;
}

export interface StartChatOptions {
  hop?: number;
}

/**
 * Session event types
 */
export type SessionEvent =
  | { type: 'session_created'; botId: string; sessionId?: string; session?: ChatSessionSummary }
  | { type: 'session_updated'; botId: string; sessionId: string; session?: ChatSessionSummary }
  | { type: 'session_destroyed'; botId: string; sessionId?: string }
  | { type: 'session_idle'; botId: string }
  | { type: 'message_start'; botId: string; messageId: string }
  | { type: 'message_update'; botId: string; messageId: string; delta?: string; text?: string }
  | { type: 'message_end'; botId: string; messageId: string; text: string }
  | { type: 'tool_call'; botId: string; tool: string; args: unknown }
  | { type: 'status_change'; botId: string; status: 'idle' | 'active' | 'settling' }
  | { type: 'error'; botId: string; error: string }
  | { type: 'bot_event'; event: BotSseEvent };

export type { ChatSessionSummary, SessionStats, ThinkingLevel };
