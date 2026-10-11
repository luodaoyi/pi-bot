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
  constructor(private baseUrl: string = '/api') {}

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
    const data = await this.request<{ bots: Bot[] }>('/api/bots');
    return data.bots;
  }

  async getBot(id: string): Promise<Bot> {
    const data = await this.request<{ bot: Bot }>(`/api/bots/${id}`);
    return data.bot;
  }

  async createBot(data: CreateBotRequest): Promise<Bot> {
    const result = await this.request<{ bot: Bot }>('/api/bots', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return result.bot;
  }

  async updateBot(id: string, data: UpdateBotRequest): Promise<Bot> {
    const result = await this.request<{ bot: Bot }>(`/api/bots/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return result.bot;
  }

  async deleteBot(id: string): Promise<void> {
    await this.request<{ success: boolean }>(`/api/bots/${id}`, { method: 'DELETE' });
  }

  async getChatHistory(botId: string, limit = 50): Promise<Message[]> {
    const data = await this.request<{ messages: Message[] }>(
      `/api/bots/${botId}/history?limit=${limit}`
    );
    return data.messages || [];
  }

  async sendMessage(botId: string, data: SendMessageRequest): Promise<void> {
    // 真实 daemon 在 POST /chat 上流式返回，发送由 streamChat 完成
    void botId;
    void data;
  }

  streamChat(
    botId: string,
    onEvent: (event: StreamEvent) => void,
    content?: string
  ): () => void {
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(`${this.baseUrl}/bots/${botId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: content ?? '', content }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const result = await response.json().catch(() => ({ error: response.statusText })) as { error?: string };
          onEvent({ type: 'error', content: result.error || 'Request failed' });
          return;
        }

        const contentType = response.headers.get('content-type') || '';
        if (!response.body || !contentType.includes('text/event-stream')) {
          onEvent({ type: 'agent_settled' });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() ?? '';
          for (const chunk of chunks) {
            const line = chunk.split('\n').find((l) => l.startsWith('data:'));
            if (!line) continue;
            try {
              const payload = JSON.parse(line.slice(5).trim()) as {
                type?: string;
                delta?: string;
                text?: string;
                content?: string;
              };
              if (payload.type === 'delta' || payload.type === 'text_delta') {
                onEvent({ type: 'text_delta', content: payload.delta ?? payload.content ?? '' });
              } else if (payload.type === 'done' || payload.type === 'agent_settled') {
                onEvent({ type: 'agent_settled', content: payload.text });
              } else if (payload.type === 'error') {
                onEvent({ type: 'error', content: payload.text ?? payload.content });
              }
            } catch {
              // 忽略无法解析的 SSE 行
            }
          }
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
    };
  }

  async searchMemory(data: MemorySearchRequest): Promise<MemoryEntry[]> {
    const params = new URLSearchParams();
    if (data.query) params.set('query', data.query);
    if (data.scope) params.set('scope', data.scope);
    if (data.limit) params.set('limit', data.limit.toString());
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
    const data = await this.request<{ models: Record<string, unknown>[] }>('/api/system/models');
    return (data.models || []).map((m) => normalizeModel(m));
  }

  async getSettings(): Promise<Settings> {
    const data = await this.request<{ settings?: Settings }>('/api/settings');
    return data.settings as Settings;
  }

  async updateSettings(data: Partial<Settings>): Promise<Settings> {
    const result = await this.request<{ settings: Settings }>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return result.settings;
  }
}
