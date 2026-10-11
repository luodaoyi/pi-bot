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

export class HttpApiClient implements ApiClient {
  constructor(private baseUrl: string = 'http://127.0.0.1:8787') {}

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new ApiError(response.status, error.message || 'Request failed', error);
    }

    return response.json();
  }

  async ping(): Promise<{ status: 'ok'; version: string }> {
    return this.request('/api/health');
  }

  async getBots(): Promise<Bot[]> {
    return this.request('/api/bots');
  }

  async getBot(id: string): Promise<Bot> {
    return this.request(`/api/bots/${id}`);
  }

  async createBot(data: CreateBotRequest): Promise<Bot> {
    return this.request('/api/bots', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBot(id: string, data: UpdateBotRequest): Promise<Bot> {
    return this.request(`/api/bots/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteBot(id: string): Promise<void> {
    await this.request(`/api/bots/${id}`, { method: 'DELETE' });
  }

  async getChatHistory(botId: string, limit = 50): Promise<Message[]> {
    return this.request(`/api/bots/${botId}/messages?limit=${limit}`);
  }

  async sendMessage(botId: string, data: SendMessageRequest): Promise<void> {
    await this.request(`/api/bots/${botId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  streamChat(botId: string, onEvent: (event: StreamEvent) => void): () => void {
    const eventSource = new EventSource(`${this.baseUrl}/api/bots/${botId}/stream`);
    
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
    return this.request('/api/groups');
  }

  async getGroup(id: string): Promise<Group> {
    return this.request(`/api/groups/${id}`);
  }

  async createGroup(data: CreateGroupRequest): Promise<Group> {
    return this.request('/api/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateGroup(id: string, data: Partial<CreateGroupRequest>): Promise<Group> {
    return this.request(`/api/groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteGroup(id: string): Promise<void> {
    await this.request(`/api/groups/${id}`, { method: 'DELETE' });
  }

  async getGroupMessages(id: string, limit = 50): Promise<Message[]> {
    return this.request(`/api/groups/${id}/messages?limit=${limit}`);
  }

  async postToGroup(id: string, message: string): Promise<void> {
    await this.request(`/api/groups/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async searchMemory(data: MemorySearchRequest): Promise<MemoryEntry[]> {
    const params = new URLSearchParams();
    if (data.query) params.set('query', data.query);
    if (data.scope) params.set('scope', data.scope);
    if (data.limit) params.set('limit', data.limit.toString());
    return this.request(`/api/memory/search?${params}`);
  }

  async getMemoryEntry(id: string): Promise<MemoryEntry> {
    return this.request(`/api/memory/${id}`);
  }

  async writeMemory(botId: string, data: MemoryWriteRequest): Promise<MemoryEntry> {
    return this.request(`/api/bots/${botId}/memory`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMemory(id: string, content: string): Promise<MemoryEntry> {
    return this.request(`/api/memory/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    });
  }

  async forgetMemory(id: string): Promise<void> {
    await this.request(`/api/memory/${id}`, { method: 'DELETE' });
  }

  async getMemorySummary(scope: 'bot' | 'team', botId?: string): Promise<string> {
    const params = new URLSearchParams({ scope });
    if (botId) params.set('botId', botId);
    const result = await this.request<{ summary: string }>(`/api/memory/summary?${params}`);
    return result.summary;
  }

  async getTasks(): Promise<ScheduledTask[]> {
    return this.request('/api/tasks');
  }

  async getTask(id: string): Promise<ScheduledTask> {
    return this.request(`/api/tasks/${id}`);
  }

  async createTask(data: CreateScheduleRequest): Promise<ScheduledTask> {
    return this.request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: string, data: Partial<CreateScheduleRequest>): Promise<ScheduledTask> {
    return this.request(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id: string): Promise<void> {
    await this.request(`/api/tasks/${id}`, { method: 'DELETE' });
  }

  async toggleTask(id: string, enabled: boolean): Promise<ScheduledTask> {
    return this.request(`/api/tasks/${id}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  }

  async getSecrets(): Promise<Secret[]> {
    return this.request('/api/secrets');
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
    return this.request(`/api/usage?${params}`);
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    return this.request('/api/models');
  }

  async getSettings(): Promise<Settings> {
    return this.request('/api/settings');
  }

  async updateSettings(data: Partial<Settings>): Promise<Settings> {
    return this.request('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
}
