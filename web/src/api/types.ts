/**
 * Shared GUI ↔ daemon contract types.
 * Mirror of src/shared/api-types.ts + settings-types.ts + bot-types.ts.
 */

export interface ModelInfo {
  provider: string;
  id: string;
  name: string;
  contextWindow: number;
  reasoning: boolean;
  input: string[];
  hasAuth: boolean;
}

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
}

export interface OAuthStartResponse {
  url: string;
  flowId: string;
}

export interface OAuthPollResponse {
  status: 'pending' | 'done' | 'error';
  error?: string;
}

export type ThinkingLevelSetting =
  | 'off'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max';

export interface SettingsModelRef {
  provider: string;
  id: string;
}

export interface GuiSettings {
  language: 'zh-CN' | 'en-US';
  theme: 'light' | 'dark' | 'auto';
  memoryBackend: 'respire' | 'markdown' | 'off';
  memoryReview: boolean;
  maxSessions: number;
  idleTimeoutMinutes: number;
  defaultModel: SettingsModelRef | null;
  defaultThinking: ThinkingLevelSetting | null;
  loadUserExtensions: boolean;
  loadContextFiles: boolean;
  timezone: string;
  workdir: string;
}

export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export interface ModelRef {
  provider: string;
  id: string;
}

export type BotModel = ModelRef | null;

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

export interface ChatSessionDetail {
  session: ChatSessionSummary;
  messages: unknown[];
  stats: SessionStats;
}

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
