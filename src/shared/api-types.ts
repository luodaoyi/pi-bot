/**
 * HTTP API request/response types for pi-bot daemon
 * These types define the contract between the web UI and the daemon
 */

import type {
  BotConfig,
  BotModel,
  GroupConfig,
  ModelRef,
  Schedule,
  Secret,
  ThinkingLevel,
} from './bot-types.js';
import type { RecallResult, RememberResult } from './memory-types.js';

// Re-export request types for convenience
export type {
  BotCreateRequest,
  BotModel,
  BotUpdateRequest,
  GroupCreateRequest,
  ModelRef,
  SecretCreateRequest,
  ThinkingLevel,
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
  id: string;
  name: string;
  contextWindow: number;
  reasoning: boolean;
  input: string[];
  hasAuth: boolean;
  /** @deprecated 旧 GUI 字段；新合同用 id */
  modelId?: string;
  supportsVision?: boolean;
  supportsThinking?: boolean;
}

/** GUI 模型目录条目，与 ModelInfo 同形 */
export type PiModel = ModelInfo;

export interface ListModelsResponse {
  models: ModelInfo[];
  defaultModel: { provider: string; id: string } | null;
  defaultThinking: string | null;
}

export interface ProviderInfo {
  id: string;
  name: string;
  authType: 'apiKey' | 'oauth' | 'both';
  configured: boolean;
  source: 'auth.json' | 'env' | null;
}

export interface ListProvidersResponse {
  providers: ProviderInfo[];
}

export interface PutProviderApiKeyRequest {
  apiKey: string;
}

export interface PutProviderApiKeyResponse {
  configured: true;
}

export interface DeleteProviderAuthResponse {
  configured: false;
  existed: boolean;
}

export interface OAuthStartResponse {
  url: string;
  flowId: string;
}

export interface OAuthPollResponse {
  status: 'pending' | 'done' | 'error';
  error?: string;
}

// ============================================================================
// Sessions
// ============================================================================

export interface SessionStats {
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
  cost: number;
  contextUsage: {
    tokens: number;
    contextWindow: number;
    percent: number;
  } | null;
}

export interface ChatSessionSummary {
  id: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  model: BotModel;
  thinking: ThinkingLevel | null;
  isActive: boolean;
}

export type SessionSummary = ChatSessionSummary;

export interface ChatSessionDetail {
  session: ChatSessionSummary;
  messages: unknown[];
  stats: SessionStats;
}

export type SessionDetail = ChatSessionDetail;

export interface CreateSessionRequest {
  name?: string;
}

export interface PatchSessionRequest {
  name?: string;
  model?: ModelRef | null;
  thinking?: ThinkingLevel | null;
}

export interface ForkSessionRequest {
  entryId: string;
}

export interface ChatRequest {
  message?: string;
  content?: string;
  sessionId?: string;
}

export interface ChatAccepted {
  sessionId: string;
  runId: string;
}

export interface AbortRequest {
  sessionId?: string;
}

export type BotSseEventType =
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

export interface BotSseEvent {
  type: BotSseEventType;
  botId: string;
  sessionId: string;
  runId: string;
  role?: string;
  delta?: string;
  text?: string;
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  result?: unknown;
  isError?: boolean;
  error?: string;
  stats?: SessionStats;
  [key: string]: unknown;
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
  | { type: 'system'; message: string }
  | BotSseEvent;

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
