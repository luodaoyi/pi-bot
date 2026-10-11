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
      model: 'deepseek-chat',
      avatar: '🤖',
      color: '#3b82f6',
      isMain: true,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    this.bots.set(chief.id, chief);

    // Create assistant bot
    const writer: Bot = {
      id: 'bot-writer',
      name: 'Writer',
      role: 'Content Creator',
      instructions: '你是专业的内容创作者，擅长撰写文章、文档和创意内容。',
      model: 'deepseek-chat',
      avatar: '✍️',
      color: '#10b981',
      isMain: false,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    };
    this.bots.set(writer.id, writer);

    // Create code reviewer bot
    const reviewer: Bot = {
      id: 'bot-reviewer',
      name: 'Reviewer',
      role: 'Code Reviewer',
      instructions: '你是代码审查专家，专注于代码质量、最佳实践和潜在问题。',
      model: 'deepseek-chat',
      avatar: '🔍',
      color: '#f59e0b',
      isMain: false,
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    };
    this.bots.set(reviewer.id, reviewer);

    // Add sample messages with inter-bot hops
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
      {
        id: 'msg-3',
        role: 'user',
        content: '帮我写一篇关于 AI 的文章。',
        timestamp: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg-4',
        role: 'assistant',
        content: '好的，我会让 Writer 来帮你完成这个任务。',
        timestamp: new Date(Date.now() - 49 * 60 * 1000).toISOString(),
        botId: 'bot-chief',
        metadata: {
          hops: [
            {
              botId: 'bot-writer',
              content: '请写一篇关于 AI 的文章，要求专业且易懂。',
              direction: 'outgoing' as const,
              timestamp: new Date(Date.now() - 49 * 60 * 1000).toISOString(),
            },
            {
              botId: 'bot-writer',
              content: '好的，我会写一篇关于人工智能的综合文章。AI（人工智能）是计算机科学的一个重要分支，旨在创建能够模拟人类智能的系统...',
              direction: 'incoming' as const,
              timestamp: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
            },
          ],
        },
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

    // Add sample group with 3 bots
    const devTeam: Group = {
      id: 'group-dev-team',
      name: '开发团队',
      members: ['bot-chief', 'bot-writer', 'bot-reviewer'],
      admin: 'bot-chief',
      mode: 'everyone',
      notice: '欢迎来到开发团队！我们一起协作完成项目。',
      createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    };
    this.groups.set(devTeam.id, devTeam);

    // Add sample group messages with @mentions and [PASS]
    this.groupMessages.set('group-dev-team', [
      {
        id: 'gmsg-1',
        role: 'assistant',
        content: '大家好！让我们开始今天的代码审查会议。',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        fromBot: 'bot-chief',
      },
      {
        id: 'gmsg-2',
        role: 'assistant',
        content: '@Writer 请先介绍一下这次的文档更新内容。',
        timestamp: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
        fromBot: 'bot-chief',
      },
      {
        id: 'gmsg-3',
        role: 'assistant',
        content: '好的！这次我更新了 API 文档，添加了更详细的示例代码和使用说明。主要改进包括：1) 新增快速入门指南，2) 完善错误处理示例，3) 添加最佳实践章节。',
        timestamp: new Date(Date.now() - 26 * 60 * 1000).toISOString(),
        fromBot: 'bot-writer',
      },
      {
        id: 'gmsg-4',
        role: 'assistant',
        content: '文档质量很好！@Reviewer 你看一下有什么需要改进的地方吗？',
        timestamp: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
        fromBot: 'bot-chief',
      },
      {
        id: 'gmsg-5',
        role: 'assistant',
        content: '我看了一下，整体很不错。建议在错误处理部分增加一些边界情况的说明，比如网络超时、权限不足等场景。另外，示例代码可以添加更多注释。',
        timestamp: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
        fromBot: 'bot-reviewer',
      },
      {
        id: 'gmsg-6',
        role: 'assistant',
        content: '好的，我会补充这些内容。预计明天完成。',
        timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        fromBot: 'bot-writer',
      },
      {
        id: 'gmsg-7',
        role: 'assistant',
        content: '[PASS]',
        timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
        fromBot: 'bot-reviewer',
        metadata: {
          passed: true,
        },
      },
      {
        id: 'gmsg-8',
        role: 'assistant',
        content: '很好！那我们今天的会议就到这里。@Writer 明天记得更新，@Reviewer 到时候再帮忙复审一下。',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        fromBot: 'bot-chief',
      },
    ]);
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
      ...data,
      isMain: false,
      createdAt: new Date().toISOString(),
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
      ...data,
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
