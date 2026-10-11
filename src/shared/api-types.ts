/**
 * HTTP API request/response types for pi-bot daemon
 * These types define the contract between the web UI and the daemon
 */

import type {
  BotConfig,
  GroupConfig,
  Schedule,
  Secret,
} from './bot-types.js';
import type { RecallResult, RememberResult } from './memory-types.js';

// Re-export request types for convenience
export type {
  BotCreateRequest,
  BotUpdateRequest,
  GroupCreateRequest,
  SecretCreateRequest,
} from './bot-types.js';
export type { RememberRequest } from './memory-types.js';

// ============================================================================
// Bot Management
// ============================================================================

export interface ListBotsResponse {
  bots: BotConfig[];
}

export interface GetBotResponse {
  bot: BotConfig;
}

export interface CreateBotResponse {
  bot: BotConfig;
}

export interface UpdateBotResponse {
  bot: BotConfig;
}

export interface DeleteBotResponse {
  success: boolean;
}

// ============================================================================
// Messaging
// ============================================================================

export interface SendMessageRequest {
  to: string; // Bot ID
  message: string;
  replyTo?: 'me' | 'user';
}

export interface SendMessageResponse {
  messageId: string;
}

export interface AskUserRequest {
  from: string; // Bot ID
  question: string;
}

export interface AskUserResponse {
  questionId: string;
}

export interface AnswerQuestionRequest {
  questionId: string;
  answer: string;
}

// ============================================================================
// Groups
// ============================================================================

export interface ListGroupsResponse {
  groups: GroupConfig[];
}

export interface GetGroupResponse {
  group: GroupConfig;
}

export interface CreateGroupResponse {
  group: GroupConfig;
}

export interface UpdateGroupResponse {
  group: GroupConfig;
}

export interface DeleteGroupResponse {
  success: boolean;
}

export interface PostToGroupRequest {
  groupId: string;
  message: string;
  from?: string; // Bot ID (defaults to user)
}

// ============================================================================
// Memory
// ============================================================================

export interface RecallRequest {
  query: string;
  scope?: string; // 'own', 'team', or bot ID
  limit?: number;
  titlesOnly?: boolean;
}

export interface RecallResponse {
  result: RecallResult;
}

export interface RememberResponse {
  result: RememberResult;
}

export interface ForgetRequest {
  id: string;
  scope?: string;
}

export interface ForgetResponse {
  success: boolean;
}

export interface MemoryStatusResponse {
  backend: string;
  mode: 'normal' | 'readonly' | 'off';
  available: boolean;
}

// ============================================================================
// Schedules
// ============================================================================

export interface ListSchedulesResponse {
  schedules: Schedule[];
}

export interface CreateScheduleRequest {
  targetKind: 'bot' | 'group';
  targetId: string;
  message: string;
  kind: 'once' | 'daily' | 'weekly' | 'interval';
  spec: string;
  tz?: string;
}

export interface CreateScheduleResponse {
  schedule: Schedule;
}

export interface DeleteScheduleResponse {
  success: boolean;
}

// ============================================================================
// Secrets
// ============================================================================

export interface ListSecretsResponse {
  secrets: Omit<Secret, 'value'>[];
}

export interface CreateSecretResponse {
  secret: Omit<Secret, 'value'>;
}

export interface DeleteSecretResponse {
  success: boolean;
}

// ============================================================================
// Usage & Stats
// ============================================================================

export interface UsageStats {
  period: string;
  byBot: Record<
    string,
    {
      input: number;
      output: number;
      cacheRead: number;
      cost?: number;
    }
  >;
  byModel: Record<
    string,
    {
      input: number;
      output: number;
      cacheRead: number;
      cost?: number;
    }
  >;
  total: {
    input: number;
    output: number;
    cacheRead: number;
    cost?: number;
  };
}

export interface GetUsageStatsRequest {
  from?: string; // ISO date
  to?: string; // ISO date
  botId?: string;
}

export interface GetUsageStatsResponse {
  stats: UsageStats;
}

// ============================================================================
// System
// ============================================================================

export interface SystemStatusResponse {
  version: string;
  uptime: number;
  activeSessions: number;
  memoryBackend: string;
  respireStatus?: {
    available: boolean;
    version?: string;
    mode?: string;
  };
}

export interface ModelInfo {
  provider: string;
  modelId: string;
  name: string;
  contextWindow?: number;
  supportsVision?: boolean;
  supportsThinking?: boolean;
}

export interface ListModelsResponse {
  models: ModelInfo[];
}

// ============================================================================
// Server-Sent Events (SSE)
// ============================================================================

export type SSEEvent =
  | { type: 'message_update'; botId: string; data: MessageUpdateData }
  | { type: 'bot_status'; botId: string; status: 'idle' | 'thinking' | 'streaming' }
  | { type: 'question'; questionId: string; from: string; question: string }
  | { type: 'bot_created'; bot: BotConfig }
  | { type: 'bot_updated'; bot: BotConfig }
  | { type: 'bot_deleted'; id: string }
  | { type: 'system'; message: string };

export interface MessageUpdateData {
  messageId: string;
  text?: string;
  delta?: string;
  done?: boolean;
  tool?: {
    name: string;
    input?: unknown;
    output?: unknown;
  };
}
