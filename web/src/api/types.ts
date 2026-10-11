/**
 * Shared GUI ↔ daemon contract types (Agent C backend).
 * Mirror of src/shared/api-types.ts + settings-types.ts.
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
