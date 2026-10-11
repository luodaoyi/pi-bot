// HTTP API client — 对齐真实 daemon 路由与响应形状

import type { ApiClient } from './client';
import type {
  Bot,
  Message,
  Group,
  MemoryEntry,
  MemoryStatus,
  ScheduledTask,
  Secret,
  UsageStats,
  ModelInfo,
  Settings,
  StreamEvent,
} from '@/types';
import {
  ApiError,
  type CreateBotRequest,
  type UpdateBotRequest,
  type SendMessageRequest,
  type CreateGroupRequest,
  type MemorySearchRequest,
  type MemoryWriteRequest,
  type CreateScheduleRequest,
  type RequestSecretRequest,
} from './client';
import type {
  BotSseEvent,
  ChatAccepted,
  ModelsResponse,
  ModelRef,
  OAuthStart,
  OAuthStatus,
  ProviderInfo,
  SessionDetail,
  SessionSummary,
  ThinkingLevel,
} from './types';
import {
  botModelPayload,
  normalizeBot,
  normalizeSettings,
  normalizeSseEvent,
  normalizeStats,
  toModelInfo,
  toModelRef,
  toPiModel,
  toThinking,
  normalizePiMessages,
} from './normalize';
import { readSseStream } from './sse';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

function emptyUsage(period: 'day' | 'week' | 'month'): UsageStats {
  const end = new Date();
  const start = new Date(end);
  if (period === 'day') start.setDate(start.getDate() - 1);
  else if (period === 'month') start.setDate(start.getDate() - 30);
  else start.setDate(start.getDate() - 7);
  return {
    period,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    byBot: {},
    byModel: {},
    total: { inputTokens: 0, outputTokens: 0, cost: 0 },
  };
}

function mapSchedule(raw: Record<string, unknown>): ScheduledTask {
  if (raw['name'] && raw['schedule'] && typeof raw['schedule'] === 'object') {
    return raw as unknown as ScheduledTask;
  }
  const timeType = String(raw['timeType'] ?? 'daily');
  const typeMap: Record<string, ScheduledTask['schedule']['type']> = {
    at: 'once',
    daily: 'daily',
    weekly: 'weekly',
    every: 'interval',
    cron: 'interval',
  };
  const prompt = String(raw['prompt'] ?? '');
  return {
    id: String(raw['id'] ?? ''),
    name: prompt.slice(0, 40) || String(raw['id'] ?? 'task'),
    targetType: 'bot',
    targetId: String(raw['botId'] ?? ''),
    message: prompt,
    schedule: {
      type: typeMap[timeType] ?? 'daily',
      time: String(raw['time'] ?? ''),
    },
    enabled: Boolean(raw['enabled']),
    nextRun: raw['nextRun'] as string | undefined,
    lastRun: raw['lastRun'] as string | undefined,
  };
}

function toDaemonSchedule(data: CreateScheduleRequest): Record<string, unknown> {
  if ('botId' in data && 'prompt' in data) {
    return data as unknown as Record<string, unknown>;
  }
  const typeMap: Record<string, string> = {
    once: 'at',
    daily: 'daily',
    weekly: 'weekly',
    interval: 'every',
  };
  return {
    botId: data.targetId,
    prompt: data.name && data.message ? `${data.name}: ${data.message}` : (data.message || data.name),
    timeType: typeMap[data.schedule.type] ?? 'daily',
    time: data.schedule.time || (data.schedule.type === 'interval' ? `${data.schedule.interval ?? 60}m` : '09:00'),
  };
}

function normalizeGroup(raw: Record<string, unknown>): Group {
  const admin = raw['admin'];
  return {
    id: String(raw['id'] ?? ''),
    name: String(raw['name'] ?? ''),
    members: Array.isArray(raw['members']) ? (raw['members'] as string[]) : [],
    admin: Array.isArray(admin) ? admin : admin ? [String(admin)] : [],
    mode: (raw['mode'] as Group['mode']) ?? 'everyone',
    notice: raw['notice'] as string | undefined,
    createdAt: String(raw['createdAt'] ?? raw['created'] ?? ''),
  };
}

function normalizeSecret(raw: Record<string, unknown>): Secret {
  const scope = raw['scope'];
  return {
    name: String(raw['name'] ?? ''),
    purpose: String(raw['purpose'] ?? ''),
    scope: Array.isArray(scope) ? (scope as string[]) : scope === 'all' ? ['all'] : [],
    createdAt: String(raw['createdAt'] ?? ''),
    lastUsedAt: raw['lastUsedAt'] as string | undefined,
  };
}

function normalizeSessionSummary(raw: SessionSummary | undefined): SessionSummary {
  const rec = (raw && typeof raw === 'object' ? raw : {}) as SessionSummary;
  return {
    id: String(rec.id ?? ''),
    name: rec.name,
    createdAt: String(rec.createdAt ?? ''),
    updatedAt: String(rec.updatedAt ?? ''),
    messageCount: Number(rec.messageCount ?? 0),
    model: toModelRef(rec.model),
    thinking: toThinking(rec.thinking),
    isActive: Boolean(rec.isActive),
  };
}

function normalizeModel(raw: Record<string, unknown>): ModelInfo {
  return {
    id: String(raw['id'] ?? raw['modelId'] ?? ''),
    provider: String(raw['provider'] ?? ''),
    name: String(raw['name'] ?? raw['modelId'] ?? raw['id'] ?? ''),
    contextWindow: Number(raw['contextWindow'] ?? 0),
    supportsVision: Boolean(raw['supportsVision']),
    supportsThinking: Boolean(raw['supportsThinking']),
  };
}

export class HttpApiClient implements ApiClient {
  private localListeners = new Set<(event: BotSseEvent) => void>();

  constructor(private baseUrl: string = '/api') {}

  private emitLocal(event: BotSseEvent) {
    for (const listener of this.localListeners) listener(event);
  }

  private origin(): string {
    return this.baseUrl.replace(/\/api\/?$/, '');
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = path.startsWith('/api') ? path : `/api${path}`;
    const response = await fetch(`${this.baseUrl}${url.replace('/api', '')}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const result = await response.json().catch(() => ({
      success: false,
      error: response.statusText,
    })) as ApiResponse<T>;

    if (!response.ok || result.success === false) {
      throw new ApiError(
        response.status,
        result.error || 'Request failed',
        result
      );
    }

    return result.data as T;
  }

  async ping(): Promise<{ status: 'ok'; version: string }> {
    try {
      const data = await this.request<{ status: 'ok'; version: string }>('/api/health');
      return { status: data.status, version: data.version };
    } catch {
      const response = await fetch(`${this.origin()}/health`);
      const data = await response.json() as { status: 'ok'; version: string };
      if (!response.ok) {
        throw new ApiError(response.status, 'Health check failed', data);
      }
      return { status: data.status, version: data.version };
    }
  }

  async getBots(): Promise<Bot[]> {
    const data = await this.request<{ bots: unknown[] }>('/api/bots');
    return (data.bots || []).map(normalizeBot);
  }

  async getBot(id: string): Promise<Bot> {
    const data = await this.request<{ bot: unknown }>(`/api/bots/${id}`);
    return normalizeBot(data.bot);
  }

  async createBot(data: CreateBotRequest): Promise<Bot> {
    const result = await this.request<{ bot: unknown }>('/api/bots', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        model: data.model === undefined ? undefined : botModelPayload(data.model),
      }),
    });
    return normalizeBot(result.bot);
  }

  async updateBot(id: string, data: UpdateBotRequest): Promise<Bot> {
    const result = await this.request<{ bot: unknown }>(`/api/bots/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...data,
        model: data.model === undefined ? undefined : botModelPayload(data.model),
      }),
    });
    return normalizeBot(result.bot);
  }

  async deleteBot(id: string): Promise<void> {
    await this.request<{ success: boolean }>(`/api/bots/${id}`, { method: 'DELETE' });
  }

  async getChatHistory(botId: string, limit = 50): Promise<Message[]> {
    const data = await this.request<{ messages?: unknown[] }>(
      `/api/bots/${botId}/history?limit=${limit}`
    );
    return normalizePiMessages(data.messages).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp ?? new Date().toISOString(),
      thinking: m.thinking,
      toolCalls: m.toolCalls,
      error: m.error,
    }));
  }

  async sendMessage(botId: string, data: SendMessageRequest): Promise<void> {
    await this.sendChat(botId, data.content);
  }

  streamChat(
    botId: string,
    onEvent: (event: StreamEvent) => void,
    content?: string
  ): () => void {
    const controller = new AbortController();
    const emit = (event: BotSseEvent) => {
      if (event.type === 'bot.text_delta') {
        onEvent({ type: 'text_delta', content: event.delta ?? event.content ?? '' });
      } else if (event.type === 'bot.message_start') {
        onEvent({ type: 'message_start', messageId: event.messageId });
      } else if (event.type === 'bot.turn_end' || event.type === 'bot.message_end') {
        onEvent({ type: 'agent_settled', content: event.text ?? event.content });
      } else if (event.type === 'bot.error') {
        onEvent({ type: 'error', content: event.error ?? event.message ?? event.content });
      } else if (event.type === 'bot.tool_start') {
        onEvent({ type: 'tool_start', content: event.toolName });
      } else if (event.type === 'bot.tool_end') {
        onEvent({ type: 'tool_end', content: event.toolName });
      }
    };

    void (async () => {
      try {
        const accepted = await this.postChat(botId, content ?? '', undefined, controller.signal);
        if (accepted.mode === 'accepted') {
          const stop = this.subscribeEvents((event) => {
            if (event.botId && event.botId !== botId) return;
            if (accepted.runId && event.runId && event.runId !== accepted.runId) return;
            emit(event);
            if (event.type === 'bot.turn_end' || event.type === 'bot.error') stop();
          });
          controller.signal.addEventListener('abort', stop);
          return;
        }
        if (accepted.mode === 'stream' && accepted.body) {
          await readSseStream(accepted.body, (event) => {
            this.emitLocal(event);
            emit(event);
          }, controller.signal);
          onEvent({ type: 'agent_settled' });
          return;
        }
        onEvent({ type: 'agent_settled' });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          onEvent({ type: 'error', content: error instanceof Error ? error.message : 'Stream failed' });
        }
      }
    })();

    return () => controller.abort();
  }

  private async postChat(
    botId: string,
    message: string,
    sessionId?: string,
    signal?: AbortSignal
  ): Promise<{ mode: 'accepted'; sessionId: string; runId: string } | { mode: 'stream'; body: ReadableStream<Uint8Array> | null } | { mode: 'ok' }> {
    const response = await fetch(`${this.baseUrl}/bots/${botId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, content: message, sessionId }),
      signal,
    });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      const result = await response.json().catch(() => ({ error: response.statusText })) as { error?: string };
      throw new ApiError(response.status, result.error || 'Request failed', result);
    }
    if (response.status === 202 || contentType.includes('application/json')) {
      const result = await response.json() as { success?: boolean; data?: ChatAccepted; sessionId?: string; runId?: string; error?: string };
      if (result.success === false) {
        throw new ApiError(response.status, result.error || 'Request failed', result);
      }
      const data = result.data ?? result;
      return {
        mode: 'accepted',
        sessionId: String(data.sessionId ?? sessionId ?? ''),
        runId: String(data.runId ?? ''),
      };
    }
    if (contentType.includes('text/event-stream')) {
      return { mode: 'stream', body: response.body };
    }
    return { mode: 'ok' };
  }

  async sendChat(botId: string, message: string, sessionId?: string): Promise<ChatAccepted> {
    const accepted = await this.postChat(botId, message, sessionId);
    if (accepted.mode === 'accepted') {
      return { sessionId: accepted.sessionId, runId: accepted.runId };
    }
    const runId = `legacy-${Date.now()}`;
    if (accepted.mode === 'stream' && accepted.body) {
      void readSseStream(accepted.body, (event) => {
        this.emitLocal({ ...event, botId, sessionId: event.sessionId ?? sessionId, runId: event.runId ?? runId });
      }).then(() => {
        this.emitLocal({ type: 'bot.turn_end', botId, sessionId: sessionId ?? '', runId });
      }).catch((error) => {
        if ((error as Error).name !== 'AbortError') {
          this.emitLocal({
            type: 'bot.error',
            botId,
            sessionId: sessionId ?? '',
            runId,
            error: error instanceof Error ? error.message : 'Stream failed',
          });
        }
      });
    }
    return { sessionId: sessionId ?? '', runId };
  }

  async abortChat(botId: string, sessionId?: string): Promise<void> {
    await this.request(`/api/bots/${botId}/abort`, {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  }

  subscribeEvents(onEvent: (event: BotSseEvent) => void): () => void {
    this.localListeners.add(onEvent);
    const controller = new AbortController();
    void (async () => {
      while (!controller.signal.aborted) {
        try {
          const response = await fetch(`${this.origin() || ''}/api/events`, {
            headers: { Accept: 'text/event-stream' },
            signal: controller.signal,
          });
          if (!response.ok || !response.body) {
            await new Promise((r) => setTimeout(r, 500));
            continue;
          }
          await readSseStream(response.body, (event) => {
            const normalized = normalizeSseEvent(event);
            if (normalized) onEvent(normalized);
          }, controller.signal);
        } catch (error) {
          if ((error as Error).name === 'AbortError') break;
        }
        if (!controller.signal.aborted) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    })();
    return () => {
      this.localListeners.delete(onEvent);
      controller.abort();
    };
  }

  async getModels(): Promise<ModelsResponse> {
    try {
      const data = await this.request<{
        models?: unknown[];
        defaultModel?: unknown;
        defaultThinking?: unknown;
      }>('/api/models');
      return {
        models: (data.models || []).map(toPiModel),
        defaultModel: data.defaultModel && typeof data.defaultModel === 'object'
          ? { provider: String((data.defaultModel as ModelRef).provider ?? ''), id: String((data.defaultModel as ModelRef).id ?? '') }
          : null,
        defaultThinking: toThinking(data.defaultThinking),
      };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        const data = await this.request<{ models?: unknown[] }>('/api/system/models');
        return {
          models: (data.models || []).map(toPiModel),
          defaultModel: null,
          defaultThinking: null,
        };
      }
      throw error;
    }
  }

  async getProviders(): Promise<ProviderInfo[]> {
    const data = await this.request<{ providers: ProviderInfo[] }>('/api/providers');
    return data.providers || [];
  }

  async setProviderApiKey(id: string, apiKey: string): Promise<{ configured: true }> {
    const data = await this.request<{ configured: true }>(`/api/providers/${encodeURIComponent(id)}/api-key`, {
      method: 'PUT',
      body: JSON.stringify({ apiKey }),
    });
    return { configured: Boolean(data.configured) as true };
  }

  async deleteProviderAuth(id: string): Promise<void> {
    await this.request(`/api/providers/${encodeURIComponent(id)}/auth`, { method: 'DELETE' });
  }

  async startProviderOAuth(id: string): Promise<OAuthStart> {
    const data = await this.request<OAuthStart>(`/api/providers/${encodeURIComponent(id)}/oauth/start`, {
      method: 'POST',
    });
    return data;
  }

  async getProviderOAuthStatus(id: string, flowId: string): Promise<OAuthStatus> {
    return this.request<OAuthStatus>(
      `/api/providers/${encodeURIComponent(id)}/oauth/${encodeURIComponent(flowId)}`
    );
  }

  async listSessions(botId: string): Promise<SessionSummary[]> {
    const data = await this.request<{ sessions: SessionSummary[] }>(`/api/bots/${botId}/sessions`);
    return (data.sessions || []).map(normalizeSessionSummary);
  }

  async createSession(botId: string, name?: string): Promise<SessionSummary> {
    const data = await this.request<{ session: SessionSummary }>(`/api/bots/${botId}/sessions`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return normalizeSessionSummary(data.session);
  }

  async getSession(botId: string, sessionId: string): Promise<SessionDetail> {
    const data = await this.request<SessionDetail>(`/api/bots/${botId}/sessions/${sessionId}`);
    return {
      session: normalizeSessionSummary(data.session),
      messages: normalizePiMessages(data.messages),
      stats: normalizeStats(data.stats),
    };
  }

  async updateSession(
    botId: string,
    sessionId: string,
    patch: { name?: string; model?: ModelRef | null; thinking?: ThinkingLevel | null }
  ): Promise<SessionSummary> {
    const data = await this.request<{ session: SessionSummary }>(`/api/bots/${botId}/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return normalizeSessionSummary(data.session);
  }

  async activateSession(botId: string, sessionId: string): Promise<SessionSummary> {
    const data = await this.request<{ session: SessionSummary }>(
      `/api/bots/${botId}/sessions/${sessionId}/activate`,
      { method: 'POST' }
    );
    return normalizeSessionSummary(data.session);
  }

  async forkSession(botId: string, sessionId: string, entryId: string): Promise<SessionSummary> {
    const data = await this.request<{ session: SessionSummary }>(
      `/api/bots/${botId}/sessions/${sessionId}/fork`,
      { method: 'POST', body: JSON.stringify({ entryId }) }
    );
    return normalizeSessionSummary(data.session);
  }

  async deleteSession(botId: string, sessionId: string): Promise<void> {
    await this.request(`/api/bots/${botId}/sessions/${sessionId}`, { method: 'DELETE' });
  }

  async getGroups(): Promise<Group[]> {
    const data = await this.request<{ groups: Record<string, unknown>[] }>('/api/groups');
    return (data.groups || []).map((g) => normalizeGroup(g));
  }

  async getGroup(id: string): Promise<Group> {
    const data = await this.request<{ group: Record<string, unknown> }>(`/api/groups/${id}`);
    return normalizeGroup(data.group);
  }

  async createGroup(data: CreateGroupRequest): Promise<Group> {
    const body = {
      ...data,
      admin: Array.isArray(data.admin) ? data.admin : data.admin ? [data.admin] : data.members.slice(0, 1),
    };
    const result = await this.request<{ group: Record<string, unknown> }>('/api/groups', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return normalizeGroup(result.group);
  }

  async updateGroup(id: string, data: Partial<CreateGroupRequest>): Promise<Group> {
    const result = await this.request<{ group: Record<string, unknown> }>(`/api/groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return normalizeGroup(result.group);
  }

  async deleteGroup(id: string): Promise<void> {
    await this.request<{ success: boolean }>(`/api/groups/${id}`, { method: 'DELETE' });
  }

  async getGroupMessages(id: string, limit = 50): Promise<Message[]> {
    const data = await this.request<{ log: Array<{ message?: string; from?: string; timestamp?: number; seq?: number }> }>(
      `/api/groups/${id}/history?limit=${limit}`
    );
    return (data.log || []).map((entry) => ({
      id: `log-${entry.seq ?? entry.timestamp ?? Date.now()}`,
      role: entry.from === 'user' ? 'user' : 'assistant',
      content: entry.message ?? '',
      timestamp: entry.timestamp ? new Date(entry.timestamp).toISOString() : new Date().toISOString(),
      fromBot: entry.from !== 'user' ? entry.from : undefined,
    }));
  }

  async postToGroup(id: string, message: string): Promise<void> {
    await this.request(`/api/groups/${id}/post`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async getMemoryStatus(): Promise<MemoryStatus> {
    const data = await this.request<MemoryStatus>('/api/memory/status');
    return {
      available: Boolean(data.available),
      reason: data.available ? undefined : (data.reason || data.error || 'Respire not running'),
      error: data.error,
      counts: data.counts,
      status: data.status,
    };
  }

  async searchMemory(data: MemorySearchRequest): Promise<MemoryEntry[]> {
    const params = new URLSearchParams();
    if (data.query) params.set('query', data.query);
    if (data.scope) params.set('scope', data.scope);
    if (data.limit) params.set('limit', data.limit.toString());
    if (data.mode) params.set('mode', data.mode);
    const result = await this.request<{
      available?: boolean;
      reason?: string;
      error?: string;
      entries?: MemoryEntry[];
    }>(`/api/memory/search?${params}`);
    if (result.available === false) {
      throw new ApiError(503, result.reason || result.error || 'Respire not running', result);
    }
    return result.entries || [];
  }

  async getMemoryEntry(id: string): Promise<MemoryEntry> {
    const data = await this.request<{ entry: MemoryEntry; available?: boolean; reason?: string }>(`/api/memory/${id}`);
    if (data.available === false) {
      throw new ApiError(503, data.reason || 'Respire not running', data);
    }
    return data.entry;
  }

  async writeMemory(botId: string, data: MemoryWriteRequest): Promise<MemoryEntry> {
    const result = await this.request<{ entry: MemoryEntry }>(`/api/bots/${botId}/memory`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return result.entry;
  }

  async updateMemory(id: string, content: string): Promise<MemoryEntry> {
    const result = await this.request<{ entry: MemoryEntry }>(`/api/memory/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    });
    return result.entry;
  }

  async forgetMemory(id: string): Promise<void> {
    await this.request<{ success: boolean }>(`/api/memory/${id}`, { method: 'DELETE' });
  }

  async getMemorySummary(scope: 'bot' | 'team', botId?: string): Promise<string> {
    const params = new URLSearchParams({ scope });
    if (botId) params.set('botId', botId);
    const result = await this.request<{ summary?: string; available?: boolean; reason?: string }>(
      `/api/memory/summary?${params}`
    );
    if (result.available === false) {
      throw new ApiError(503, result.reason || 'Respire not running', result);
    }
    return result.summary || '';
  }

  async getTasks(): Promise<ScheduledTask[]> {
    const data = await this.request<{ schedules: Record<string, unknown>[] }>('/api/tasks');
    return (data.schedules || []).map((s) => mapSchedule(s));
  }

  async getTask(id: string): Promise<ScheduledTask> {
    const data = await this.request<{ schedule: Record<string, unknown> }>(`/api/tasks/${id}`);
    return mapSchedule(data.schedule);
  }

  async createTask(data: CreateScheduleRequest): Promise<ScheduledTask> {
    const result = await this.request<{ schedule: Record<string, unknown> }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(toDaemonSchedule(data)),
    });
    return mapSchedule(result.schedule);
  }

  async updateTask(id: string, data: Partial<CreateScheduleRequest>): Promise<ScheduledTask> {
    const result = await this.request<{ schedule: Record<string, unknown> }>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return mapSchedule(result.schedule);
  }

  async deleteTask(id: string): Promise<void> {
    await this.request<{ success: boolean }>(`/api/tasks/${id}`, { method: 'DELETE' });
  }

  async toggleTask(id: string, enabled: boolean): Promise<ScheduledTask> {
    const result = await this.request<{ schedule: Record<string, unknown> }>(`/api/tasks/${id}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
    return mapSchedule(result.schedule);
  }

  async getSecrets(): Promise<Secret[]> {
    const data = await this.request<{ secrets: Record<string, unknown>[] }>('/api/secrets');
    return (data.secrets || []).map((s) => normalizeSecret(s));
  }

  async requestSecret(data: RequestSecretRequest): Promise<void> {
    await this.request('/api/secrets', {
      method: 'POST',
      body: JSON.stringify({
        name: data.name,
        purpose: data.purpose,
        value: data.value,
        requestedBy: 'ui',
        scope: 'all',
      }),
    });
  }

  async revokeSecret(name: string, _botId: string): Promise<void> {
    await this.request(`/api/secrets/${encodeURIComponent(name)}/revoke`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async getUsageStats(period: 'day' | 'week' | 'month', startDate?: string): Promise<UsageStats> {
    const params = new URLSearchParams({ period });
    if (startDate) params.set('startDate', startDate);
    const data = await this.request<{
      stats?: UsageStats;
      aggregations?: unknown;
      total?: UsageStats['total'];
    }>(`/api/usage/stats?${params}`);
    if (data.stats?.total) {
      return {
        period,
        startDate: data.stats.startDate,
        endDate: data.stats.endDate,
        byBot: data.stats.byBot ?? {},
        byModel: data.stats.byModel ?? {},
        total: {
          inputTokens: data.stats.total.inputTokens ?? 0,
          outputTokens: data.stats.total.outputTokens ?? 0,
          cost: data.stats.total.cost ?? 0,
        },
      };
    }
    return emptyUsage(period);
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    const models = await this.getModels();
    return models.models.map(toModelInfo);
  }

  async getSettings(): Promise<Settings> {
    const data = await this.request<{ settings?: unknown }>('/api/settings');
    return normalizeSettings(data.settings);
  }

  async updateSettings(data: Partial<Settings>): Promise<Settings> {
    const result = await this.request<{ settings: unknown }>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return normalizeSettings(result.settings);
  }
}
