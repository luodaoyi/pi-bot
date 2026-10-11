// API client interface for pi-bot daemon
// This defines the contract between web UI and daemon HTTP API

import type {
  Bot,
  Message,
  Group,
  MemoryEntry,
  ScheduledTask,
  Secret,
  UsageStats,
  ModelInfo,
  Settings,
  StreamEvent,
} from '@/types';

export interface CreateBotRequest {
  name: string;
  role: string;
  instructions: string;
  model: {
    provider: string;
    modelId: string;
  };
  look?: {
    avatar?: string;
    color?: string;
  };
  isMain?: boolean;
}

export interface UpdateBotRequest {
  name?: string;
  role?: string;
  instructions?: string;
  model?: {
    provider: string;
    modelId: string;
  };
  look?: {
    avatar?: string;
    color?: string;
  };
}

export interface SendMessageRequest {
  content: string;
  images?: string[];
}

export interface CreateGroupRequest {
  name: string;
  members: string[];
  admin: string | string[];
  mode: 'everyone' | 'admin';
  notice?: string;
}

export interface MemorySearchRequest {
  query?: string;
  scope?: 'bot' | 'team' | 'all';
  limit?: number;
  mode?: 'fast' | 'quality';
}

export interface MemoryWriteRequest {
  content: string;
  title?: string;
  scope: 'bot' | 'team';
  importance?: 'important' | 'trivial';
  replace?: string;
}

export interface CreateScheduleRequest {
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
}

export interface RequestSecretRequest {
  name: string;
  purpose: string;
  value: string;
}

/**
 * PI-Bot API Client interface
 * All methods return promises and may throw ApiError
 */
export interface ApiClient {
  // Bot Management
  getBots(): Promise<Bot[]>;
  getBot(id: string): Promise<Bot>;
  createBot(data: CreateBotRequest): Promise<Bot>;
  updateBot(id: string, data: UpdateBotRequest): Promise<Bot>;
  deleteBot(id: string): Promise<void>;

  // Chat
  getChatHistory(botId: string, limit?: number): Promise<Message[]>;
  sendMessage(botId: string, data: SendMessageRequest): Promise<void>;
  streamChat(botId: string, onEvent: (event: StreamEvent) => void, content?: string): () => void;

  // Groups
  getGroups(): Promise<Group[]>;
  getGroup(id: string): Promise<Group>;
  createGroup(data: CreateGroupRequest): Promise<Group>;
  updateGroup(id: string, data: Partial<CreateGroupRequest>): Promise<Group>;
  deleteGroup(id: string): Promise<void>;
  getGroupMessages(id: string, limit?: number): Promise<Message[]>;
  postToGroup(id: string, message: string): Promise<void>;

  // Memory (Respire integration)
  getMemoryStatus(): Promise<import('@/types').MemoryStatus>;
  searchMemory(data: MemorySearchRequest): Promise<MemoryEntry[]>;
  getMemoryEntry(id: string): Promise<MemoryEntry>;
  writeMemory(botId: string, data: MemoryWriteRequest): Promise<MemoryEntry>;
  updateMemory(id: string, content: string): Promise<MemoryEntry>;
  forgetMemory(id: string): Promise<void>;
  getMemorySummary(scope: 'bot' | 'team', botId?: string): Promise<string>;

  // Scheduled Tasks
  getTasks(): Promise<ScheduledTask[]>;
  getTask(id: string): Promise<ScheduledTask>;
  createTask(data: CreateScheduleRequest): Promise<ScheduledTask>;
  updateTask(id: string, data: Partial<CreateScheduleRequest>): Promise<ScheduledTask>;
  deleteTask(id: string): Promise<void>;
  toggleTask(id: string, enabled: boolean): Promise<ScheduledTask>;

  // Secrets
  getSecrets(): Promise<Secret[]>;
  requestSecret(data: RequestSecretRequest): Promise<void>;
  revokeSecret(name: string, botId: string): Promise<void>;

  // Usage & Stats
  getUsageStats(period: 'day' | 'week' | 'month', startDate?: string): Promise<UsageStats>;

  // Models
  getAvailableModels(): Promise<ModelInfo[]>;

  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(data: Partial<Settings>): Promise<Settings>;

  // Health
  ping(): Promise<{ status: 'ok'; version: string }>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
