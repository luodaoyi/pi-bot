// Core types for pi-bot Web GUI

import type {
  ModelRef,
  PiToolCall,
  SessionStats,
  ThinkingLevel,
} from '@/api/types';

export type { ModelRef, ThinkingLevel, SessionStats } from '@/api/types';

export interface Bot {
  id: string;
  name: string;
  role: string;
  instructions: string;
  /** null = 跟随 pi 默认模型 */
  model: ModelRef | null;
  thinking?: ThinkingLevel | null;
  look?: {
    avatar?: string;
    color?: string;
  };
  isMain: boolean;
  created: string;
  segments: string[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  botId?: string;
  fromBot?: string;
  thinking?: string;
  toolCalls?: PiToolCall[];
  streaming?: boolean;
  error?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  status: 'pending' | 'success' | 'error';
}

export interface Group {
  id: string;
  name: string;
  members: string[];
  admin: string[];
  mode: 'everyone' | 'admin';
  notice?: string;
  createdAt: string;
}

export interface MemoryStatus {
  available: boolean;
  reason?: string;
  error?: string;
  counts?: Record<string, number>;
  status?: Record<string, unknown>;
}

export interface MemoryEntry {
  id: string;
  content: string;
  title?: string;
  scope: 'bot' | 'team';
  botId?: string;
  kind?: string;
  project?: string;
  score?: number;
  importance: 'important' | 'trivial';
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, string>;
}

export interface ScheduledTask {
  id: string;
  name: string;
  targetType: 'bot' | 'group';
  targetId: string;
  message: string;
  schedule: {
    type: 'once' | 'daily' | 'weekly' | 'interval';
    time?: string;
    days?: number[];
    interval?: number;
  };
  enabled: boolean;
  nextRun?: string;
  lastRun?: string;
}

export interface Secret {
  name: string;
  purpose: string;
  scope: string[];
  createdAt: string;
  lastUsedAt?: string;
}

export interface UsageBucket {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  cost?: number;
}

export interface UsageStats {
  period: 'day' | 'week' | 'month';
  startDate: string;
  endDate: string;
  byBot: Record<string, UsageBucket>;
  byModel: Record<string, UsageBucket>;
  total: UsageBucket;
}

export interface ModelInfo {
  id: string;
  provider: string;
  name: string;
  contextWindow: number;
  supportsVision?: boolean;
  supportsThinking?: boolean;
  reasoning?: boolean;
  input?: string[];
  hasAuth?: boolean;
}

export interface Settings {
  language: 'zh-CN' | 'en-US';
  theme: 'light' | 'dark' | 'auto';
  memoryBackend: 'respire' | 'markdown' | 'off';
  memoryReview?: boolean;
  maxSessions: number;
  idleTimeoutMinutes: number;
  defaultModel: ModelRef | null;
  defaultThinking: ThinkingLevel | null;
  loadUserExtensions: boolean;
  loadContextFiles: boolean;
  timezone: string;
  workdir: string;
  toolDisplay: 'collapsed' | 'hidden' | 'expanded';
}

export interface ChatSession {
  botId: string;
  sessionId: string | null;
  messages: Message[];
  isStreaming: boolean;
  runId: string | null;
  stats: SessionStats;
}

export interface StreamEvent {
  type:
    | 'message_start'
    | 'text_delta'
    | 'text_end'
    | 'tool_start'
    | 'tool_end'
    | 'agent_settled'
    | 'error'
    | 'bot.message_start'
    | 'bot.text_delta'
    | 'bot.thinking_delta'
    | 'bot.tool_start'
    | 'bot.tool_update'
    | 'bot.tool_end'
    | 'bot.message_end'
    | 'bot.turn_end'
    | 'bot.error'
    | 'bot.stats';
  data?: unknown;
  messageId?: string;
  content?: string;
}
