// HTTP API client implementation for pi-bot daemon
// Connects to real daemon on localhost:8787 (configurable)

import type { ApiClient } from './client';
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
}

export class HttpApiClient implements ApiClient {
  constructor(private baseUrl: string = '/api') {}

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

    if (!response.ok || !result.success) {
      throw new ApiError(
        response.status,
        result.error || 'Request failed',
        result
      );
    }

    return result.data as T;
  }

  async ping(): Promise<{ status: 'ok'; version: string }> {
    return this.request('/api/health');
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
    await this.request(`/api/bots/${botId}/chat`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  streamChat(botId: string, onEvent: (event: StreamEvent) => void): () => void {
    const eventSource = new EventSource(`${this.baseUrl}/bots/${botId}/chat`);
    
    eventSource.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as StreamEvent;
        onEvent(event);
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = () => {
      onEvent({ type: 'error' });
      eventSource.close();
    };

    return () => eventSource.close();
  }

  async getGroups(): Promise<Group[]> {
    const data = await this.request<{ groups: Group[] }>('/api/groups');
    return data.groups || [];
  }

  async getGroup(id: string): Promise<Group> {
    const data = await this.request<{ group: Group }>(`/api/groups/${id}`);
    return data.group;
  }

  async createGroup(data: CreateGroupRequest): Promise<Group> {
    const result = await this.request<{ group: Group }>('/api/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return result.group;
  }

  async updateGroup(id: string, data: Partial<CreateGroupRequest>): Promise<Group> {
    const result = await this.request<{ group: Group }>(`/api/groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return result.group;
  }

  async deleteGroup(id: string): Promise<void> {
    await this.request<{ success: boolean }>(`/api/groups/${id}`, { method: 'DELETE' });
  }

  async getGroupMessages(id: string, limit = 50): Promise<Message[]> {
    const data = await this.request<{ log: Message[] }>(
      `/api/groups/${id}/history?limit=${limit}`
    );
    return data.log || [];
  }

  async postToGroup(id: string, message: string): Promise<void> {
    await this.request(`/api/groups/${id}/post`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async searchMemory(data: MemorySearchRequest): Promise<MemoryEntry[]> {
    const params = new URLSearchParams();
    if (data.query) params.set('query', data.query);
    if (data.scope) params.set('scope', data.scope);
    if (data.limit) params.set('limit', data.limit.toString());
    const result = await this.request<{ entries?: MemoryEntry[] }>(
      `/api/memory/search?${params}`
    );
    return result.entries || [];
  }

  async getMemoryEntry(id: string): Promise<MemoryEntry> {
    const data = await this.request<{ entry: MemoryEntry }>(`/api/memory/${id}`);
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
    const result = await this.request<{ summary: string }>(`/api/memory/summary?${params}`);
    return result.summary;
  }

  async getTasks(): Promise<ScheduledTask[]> {
    const data = await this.request<{ schedules: ScheduledTask[] }>('/api/tasks');
    return data.schedules || [];
  }

  async getTask(id: string): Promise<ScheduledTask> {
    const data = await this.request<{ schedule: ScheduledTask }>(`/api/tasks/${id}`);
    return data.schedule;
  }

  async createTask(data: CreateScheduleRequest): Promise<ScheduledTask> {
    const result = await this.request<{ schedule: ScheduledTask }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return result.schedule;
  }

  async updateTask(id: string, data: Partial<CreateScheduleRequest>): Promise<ScheduledTask> {
    const result = await this.request<{ schedule: ScheduledTask }>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return result.schedule;
  }

  async deleteTask(id: string): Promise<void> {
    await this.request<{ success: boolean }>(`/api/tasks/${id}`, { method: 'DELETE' });
  }

  async toggleTask(id: string, enabled: boolean): Promise<ScheduledTask> {
    const result = await this.request<{ schedule: ScheduledTask }>(`/api/tasks/${id}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
    return result.schedule;
  }

  async getSecrets(): Promise<Secret[]> {
    const data = await this.request<{ secrets: Secret[] }>('/api/secrets');
    return data.secrets || [];
  }

  async requestSecret(data: RequestSecretRequest): Promise<void> {
    await this.request('/api/secrets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async revokeSecret(name: string, botId: string): Promise<void> {
    await this.request(`/api/secrets/${name}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ botId }),
    });
  }

  async getUsageStats(period: 'day' | 'week' | 'month', startDate?: string): Promise<UsageStats> {
    const params = new URLSearchParams({ period });
    if (startDate) params.set('startDate', startDate);
    const data = await this.request<{ stats?: UsageStats; aggregations?: unknown }>(
      `/api/usage/stats?${params}`
    );
    return (data.stats || data) as UsageStats;
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    const data = await this.request<{ models: ModelInfo[] }>('/api/system/models');
    return data.models || [];
  }

  async getSettings(): Promise<Settings> {
    const data = await this.request<{ settings?: Settings }>('/api/settings');
    return data.settings || ({} as Settings);
  }

  async updateSettings(data: Partial<Settings>): Promise<Settings> {
    const result = await this.request<{ settings: Settings }>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return result.settings;
  }
}
