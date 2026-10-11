// Core types for pi-bot Web GUI

export interface Bot {
  id: string;
  name: string;
  role: string;
  instructions: string;
  model: string;
  avatar?: string;
  color?: string;
  isMain: boolean;
  createdAt: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  botId?: string;
  fromBot?: string;
  toolCalls?: ToolCall[];
  streaming?: boolean;
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
  admin: string;
  mode: 'everyone' | 'admin';
  notice?: string;
  createdAt: string;
}

export interface MemoryEntry {
  id: string;
  content: string;
  title?: string;
  scope: 'bot' | 'team';
  botId?: string;
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

export interface UsageStats {
  period: 'day' | 'week' | 'month';
  startDate: string;
  endDate: string;
  byBot: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    cost?: number;
  }>;
  byModel: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cost?: number;
  }>;
  total: {
    inputTokens: number;
    outputTokens: number;
    cost?: number;
  };
}

export interface ModelInfo {
  id: string;
  provider: string;
  name: string;
  contextWindow: number;
  supportsVision?: boolean;
  supportsThinking?: boolean;
}

export interface Settings {
  language: 'zh-CN' | 'en-US';
  theme: 'light' | 'dark' | 'auto';
  memoryBackend: 'respire' | 'markdown' | 'off';
  memoryReview: boolean;
  maxSessions: number;
}

export interface ChatSession {
  botId: string;
  messages: Message[];
  isStreaming: boolean;
}

export interface StreamEvent {
  type: 'message_start' | 'text_delta' | 'text_end' | 'tool_start' | 'tool_end' | 'agent_settled' | 'error';
  data?: unknown;
  messageId?: string;
  content?: string;
}
