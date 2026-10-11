/**
 * Shared GUI ↔ daemon contract types.
 * Mirror of src/shared/api-types.ts + settings-types.ts + bot-types.ts，并补充 GUI 会话字段。
 */

export type ThinkingLevel =
  | 'off'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max';

export const THINKING_LEVELS: ThinkingLevel[] = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
];

export type ThinkingLevelSetting = ThinkingLevel;

export interface ModelRef {
  provider: string;
  id: string;
}

export type SettingsModelRef = ModelRef;
export type BotModel = ModelRef | null;

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

/** GET /api/models 条目 */
export type PiModel = ModelInfo;

export interface ListModelsResponse {
  models: ModelInfo[];
  defaultModel: ModelRef | null;
  defaultThinking: ThinkingLevel | null;
}

export type ModelsResponse = ListModelsResponse;

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

export type OAuthStart = OAuthStartResponse;

export interface OAuthPollResponse {
  status: 'pending' | 'done' | 'error';
  error?: string;
}

export type OAuthStatus = OAuthPollResponse;

export interface SessionSummary {
  id: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  model: BotModel;
  thinking: ThinkingLevel | null;
  isActive: boolean;
}

export type ChatSessionSummary = SessionSummary;

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

export type ToolCallStatus = 'pending' | 'running' | 'success' | 'error';

export interface PiToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  liveOutput?: string;
  status: ToolCallStatus;
  isError?: boolean;
}

export interface PiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  toolCalls?: PiToolCall[];
  timestamp?: string;
  error?: string;
  streaming?: boolean;
}

export interface SessionDetail {
  session: SessionSummary;
  messages: PiMessage[];
  stats: SessionStats;
}

export type ChatSessionDetail = SessionDetail;

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
  type: BotSseEventType | string;
  botId?: string;
  sessionId?: string;
  runId?: string;
  role?: string;
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  result?: unknown;
  isError?: boolean;
  delta?: string;
  text?: string;
  content?: string;
  error?: string;
  message?: string;
  stats?: SessionStats;
  messageId?: string;
  [key: string]: unknown;
}

export interface ChatAccepted {
  sessionId: string;
  runId: string;
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

export type ContractSettings = GuiSettings;

export function emptySessionStats(): SessionStats {
  return {
    tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    cost: 0,
    contextUsage: null,
  };
}

export function modelKey(ref: ModelRef | null | undefined): string {
  if (!ref) return '';
  return `${ref.provider}/${ref.id}`;
}

export function sameModel(a: ModelRef | null | undefined, b: ModelRef | null | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.provider === b.provider && a.id === b.id;
}
