// Mock API implementation for development without daemon
// Provides realistic responses with in-memory state

import type {
  ApiClient,
  CreateBotRequest,
  UpdateBotRequest,
  SendMessageRequest,
  CreateGroupRequest,
  MemorySearchRequest,
  MemoryWriteRequest,
  CreateScheduleRequest,
  RequestSecretRequest,
} from './client';
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
import { ApiError } from './client';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class MockApiClient implements ApiClient {
  private bots: Map<string, Bot> = new Map();
  private messages: Map<string, Message[]> = new Map();
  private groups: Map<string, Group> = new Map();
  private groupMessages: Map<string, Message[]> = new Map();
  private memory: Map<string, MemoryEntry> = new Map();
  private tasks: Map<string, ScheduledTask> = new Map();
  private secrets: Map<string, Secret> = new Map();
  private settings: Settings;

  constructor() {
    this.settings = {
      language: 'zh-CN',
      theme: 'auto',
      memoryBackend: 'respire',
      memoryReview: false,
      maxSessions: 16,
    };
    this.initializeMockData();
  }

  private initializeMockData() {
    // Create main bot
    const chief: Bot = {
      id: 'bot-chief',
      name: 'Chief',
      role: 'Main Bot',
      instructions: '你是团队的主要协调者，负责管理其他 Bot 和处理复杂任务。',
      model: {
        provider: 'deepseek',
        modelId: 'deepseek-chat',
      },
      look: {
        avatar: '🤖',
        color: '#3b82f6',
      },
      isMain: true,
      created: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      segments: [],
    };
    this.bots.set(chief.id, chief);

    // Create assistant bot
    const writer: Bot = {
      id: 'bot-writer',
      name: 'Writer',
      role: 'Content Creator',
      instructions: '你是专业的内容创作者，擅长撰写文章、文档和创意内容。',
      model: {
        provider: 'deepseek',
        modelId: 'deepseek-chat',
      },
      look: {
        avatar: '✍️',
        color: '#10b981',
      },
      isMain: false,
      created: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      segments: [],
    };
    this.bots.set(writer.id, writer);

    // Add sample messages
    this.messages.set('bot-chief', [
      {
        id: 'msg-1',
        role: 'user',
        content: '你好，请介绍一下自己。',
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: '你好！我是 Chief，团队的主要协调者。我可以帮助你管理其他 Bot、创建群聊、安排任务等。有什么我可以帮助你的吗？',
        timestamp: new Date(Date.now() - 59 * 60 * 1000).toISOString(),
        botId: 'bot-chief',
      },
    ]);

    // Add sample memory
    const memEntry: MemoryEntry = {
      id: 'mem-1',
      content: '用户偏好简洁的回答风格',
      title: '用户偏好',
      scope: 'team',
      importance: 'important',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        source: 'conversation',
        by: 'Chief',
      },
    };
    this.memory.set(memEntry.id, memEntry);

    // Add sample task
    const task: ScheduledTask = {
      id: 'task-1',
      name: '每日总结',
      targetType: 'bot',
      targetId: 'bot-chief',
      message: '生成今天的工作总结',
      schedule: {
        type: 'daily',
        time: '18:00',
      },
      enabled: true,
      nextRun: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    };
    this.tasks.set(task.id, task);

    // Add sample secret
    const secret: Secret = {
      name: 'GITHUB_TOKEN',
      purpose: '访问 GitHub API',
      scope: ['bot-chief'],
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    };
    this.secrets.set(secret.name, secret);
  }

  async ping(): Promise<{ status: 'ok'; version: string }> {
    await delay(100);
    return { status: 'ok', version: '0.1.0' };
  }

  async getBots(): Promise<Bot[]> {
    await delay(200);
    return Array.from(this.bots.values());
  }

  async getBot(id: string): Promise<Bot> {
    await delay(100);
    const bot = this.bots.get(id);
    if (!bot) throw new ApiError(404, 'Bot not found');
    return bot;
  }

  async createBot(data: CreateBotRequest): Promise<Bot> {
    await delay(300);
    const bot: Bot = {
      id: `bot-${Date.now()}`,
      name: data.name,
      role: data.role,
      instructions: data.instructions,
      model: data.model,
      look: data.look,
      isMain: data.isMain || false,
      created: new Date().toISOString(),
      segments: [],
    };
    this.bots.set(bot.id, bot);
    return bot;
  }

  async updateBot(id: string, data: UpdateBotRequest): Promise<Bot> {
    await delay(200);
    const bot = this.bots.get(id);
    if (!bot) throw new ApiError(404, 'Bot not found');
    const updated = { ...bot, ...data };
    this.bots.set(id, updated);
    return updated;
  }

  async deleteBot(id: string): Promise<void> {
    await delay(200);
    const bot = this.bots.get(id);
    if (!bot) throw new ApiError(404, 'Bot not found');
    if (bot.isMain) throw new ApiError(400, 'Cannot delete main bot');
    this.bots.delete(id);
  }

  async getChatHistory(botId: string, limit = 50): Promise<Message[]> {
    await delay(200);
    const messages = this.messages.get(botId) || [];
    return messages.slice(-limit);
  }

  async sendMessage(botId: string, data: SendMessageRequest): Promise<void> {
    await delay(100);
    const messages = this.messages.get(botId) || [];
    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: data.content,
      timestamp: new Date().toISOString(),
    };
    messages.push(userMsg);
    this.messages.set(botId, messages);
  }

  streamChat(botId: string, onEvent: (event: StreamEvent) => void): () => void {
    const messageId = `msg-${Date.now()}`;
    let cancelled = false;

    (async () => {
      await delay(500);
      if (cancelled) return;

      onEvent({ type: 'message_start', messageId });

      const response = '这是一个模拟的流式响应。我正在处理你的请求...';
      const words = response.split('');

      for (let i = 0; i < words.length; i++) {
        if (cancelled) return;
        await delay(50);
        onEvent({
          type: 'text_delta',
          messageId,
          content: words[i],
        });
      }

      if (!cancelled) {
        onEvent({ type: 'text_end', messageId });
        onEvent({ type: 'agent_settled' });

        const messages = this.messages.get(botId) || [];
        const assistantMsg: Message = {
          id: messageId,
          role: 'assistant',
          content: response,
          timestamp: new Date().toISOString(),
          botId,
        };
        messages.push(assistantMsg);
        this.messages.set(botId, messages);
      }
    })();

    return () => {
      cancelled = true;
    };
  }

  async getGroups(): Promise<Group[]> {
    await delay(200);
    return Array.from(this.groups.values());
  }

  async getGroup(id: string): Promise<Group> {
    await delay(100);
    const group = this.groups.get(id);
    if (!group) throw new ApiError(404, 'Group not found');
    return group;
  }

  async createGroup(data: CreateGroupRequest): Promise<Group> {
    await delay(300);
    const group: Group = {
      id: `group-${Date.now()}`,
      name: data.name,
      members: data.members,
      admin: Array.isArray(data.admin) ? data.admin : data.admin ? [data.admin] : data.members.slice(0, 1),
      mode: data.mode,
      notice: data.notice,
      createdAt: new Date().toISOString(),
    };
    this.groups.set(group.id, group);
    return group;
  }

  async updateGroup(id: string, data: Partial<CreateGroupRequest>): Promise<Group> {
    await delay(200);
    const group = this.groups.get(id);
    if (!group) throw new ApiError(404, 'Group not found');
    const updated = { ...group, ...data };
    this.groups.set(id, updated);
    return updated;
  }

  async deleteGroup(id: string): Promise<void> {
    await delay(200);
    if (!this.groups.has(id)) throw new ApiError(404, 'Group not found');
    this.groups.delete(id);
  }

  async getGroupMessages(id: string, limit = 50): Promise<Message[]> {
    await delay(200);
    const messages = this.groupMessages.get(id) || [];
    return messages.slice(-limit);
  }

  async postToGroup(id: string, message: string): Promise<void> {
    await delay(300);
    const messages = this.groupMessages.get(id) || [];
    const msg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    messages.push(msg);
    this.groupMessages.set(id, messages);
  }

  async getMemoryStatus(): Promise<MemoryStatus> {
    await delay(50);
    return { available: true };
  }

  async searchMemory(data: MemorySearchRequest): Promise<MemoryEntry[]> {
    await delay(300);
    let entries = Array.from(this.memory.values());
    
    if (data.scope && data.scope !== 'all') {
      entries = entries.filter(e => e.scope === data.scope);
    }
    
    if (data.query) {
      const query = data.query.toLowerCase();
      entries = entries.filter(e => 
        e.content.toLowerCase().includes(query) ||
        e.title?.toLowerCase().includes(query)
      );
    }
    
    return entries.slice(0, data.limit || 20);
  }

  async getMemoryEntry(id: string): Promise<MemoryEntry> {
    await delay(100);
    const entry = this.memory.get(id);
    if (!entry) throw new ApiError(404, 'Memory entry not found');
    return entry;
  }

  async writeMemory(botId: string, data: MemoryWriteRequest): Promise<MemoryEntry> {
    await delay(300);
    const entry: MemoryEntry = {
      id: `mem-${Date.now()}`,
      content: data.content,
      title: data.title,
      scope: data.scope,
      botId,
      importance: data.importance || 'important',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.memory.set(entry.id, entry);
    return entry;
  }

  async updateMemory(id: string, content: string): Promise<MemoryEntry> {
    await delay(200);
    const entry = this.memory.get(id);
    if (!entry) throw new ApiError(404, 'Memory entry not found');
    const updated = { ...entry, content, updatedAt: new Date().toISOString() };
    this.memory.set(id, updated);
    return updated;
  }

  async forgetMemory(id: string): Promise<void> {
    await delay(200);
    if (!this.memory.has(id)) throw new ApiError(404, 'Memory entry not found');
    this.memory.delete(id);
  }

  async getMemorySummary(scope: 'bot' | 'team', botId?: string): Promise<string> {
    await delay(400);
    const entries = Array.from(this.memory.values()).filter(e => {
      if (scope === 'bot' && e.botId !== botId) return false;
      if (scope === 'team' && e.scope !== 'team') return false;
      return true;
    });
    
    if (entries.length === 0) {
      return '暂无记忆条目。';
    }
    
    return `共有 ${entries.length} 条记忆。主要包括用户偏好、工作流程和团队规范等内容。`;
  }

  async getTasks(): Promise<ScheduledTask[]> {
    await delay(200);
    return Array.from(this.tasks.values());
  }

  async getTask(id: string): Promise<ScheduledTask> {
    await delay(100);
    const task = this.tasks.get(id);
    if (!task) throw new ApiError(404, 'Task not found');
    return task;
  }

  async createTask(data: CreateScheduleRequest): Promise<ScheduledTask> {
    await delay(300);
    const task: ScheduledTask = {
      id: `task-${Date.now()}`,
      ...data,
      enabled: true,
    };
    this.tasks.set(task.id, task);
    return task;
  }

  async updateTask(id: string, data: Partial<CreateScheduleRequest>): Promise<ScheduledTask> {
    await delay(200);
    const task = this.tasks.get(id);
    if (!task) throw new ApiError(404, 'Task not found');
    const updated = { ...task, ...data };
    this.tasks.set(id, updated);
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    await delay(200);
    if (!this.tasks.has(id)) throw new ApiError(404, 'Task not found');
    this.tasks.delete(id);
  }

  async toggleTask(id: string, enabled: boolean): Promise<ScheduledTask> {
    await delay(200);
    const task = this.tasks.get(id);
    if (!task) throw new ApiError(404, 'Task not found');
    const updated = { ...task, enabled };
    this.tasks.set(id, updated);
    return updated;
  }

  async getSecrets(): Promise<Secret[]> {
    await delay(200);
    return Array.from(this.secrets.values());
  }

  async requestSecret(data: RequestSecretRequest): Promise<void> {
    await delay(300);
    const secret: Secret = {
      name: data.name,
      purpose: data.purpose,
      scope: [],
      createdAt: new Date().toISOString(),
    };
    this.secrets.set(secret.name, secret);
  }

  async revokeSecret(name: string, botId: string): Promise<void> {
    await delay(200);
    const secret = this.secrets.get(name);
    if (!secret) throw new ApiError(404, 'Secret not found');
    secret.scope = secret.scope.filter(id => id !== botId);
    if (secret.scope.length === 0) {
      this.secrets.delete(name);
    }
  }

  async getUsageStats(period: 'day' | 'week' | 'month', startDate?: string): Promise<UsageStats> {
    await delay(300);
    return {
      period,
      startDate: startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString(),
      byBot: {
        'bot-chief': {
          inputTokens: 12500,
          outputTokens: 8300,
          cacheReadTokens: 45000,
          cacheWriteTokens: 2000,
          cost: 0.85,
        },
        'bot-writer': {
          inputTokens: 8200,
          outputTokens: 6100,
          cacheReadTokens: 32000,
          cacheWriteTokens: 1500,
          cost: 0.62,
        },
      },
      byModel: {
        'deepseek-chat': {
          inputTokens: 20700,
          outputTokens: 14400,
          cost: 1.47,
        },
      },
      total: {
        inputTokens: 20700,
        outputTokens: 14400,
        cost: 1.47,
      },
    };
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    await delay(200);
    return [
      {
        id: 'deepseek-chat',
        provider: 'deepseek',
        name: 'DeepSeek Chat',
        contextWindow: 128000,
        supportsVision: true,
        supportsThinking: true,
      },
      {
        id: 'deepseek-reasoner',
        provider: 'deepseek',
        name: 'DeepSeek Reasoner',
        contextWindow: 64000,
        supportsThinking: true,
      },
      {
        id: 'gpt-4o',
        provider: 'openai',
        name: 'GPT-4o',
        contextWindow: 128000,
        supportsVision: true,
      },
      {
        id: 'claude-3-5-sonnet',
        provider: 'anthropic',
        name: 'Claude 3.5 Sonnet',
        contextWindow: 200000,
        supportsVision: true,
      },
    ];
  }

  async getSettings(): Promise<Settings> {
    await delay(100);
    return { ...this.settings };
  }

  async updateSettings(data: Partial<Settings>): Promise<Settings> {
    await delay(200);
    this.settings = { ...this.settings, ...data };
    return { ...this.settings };
  }
}
