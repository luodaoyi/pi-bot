// Mock API — 仅用于开发 / 单测，形状与 CONTRACT.md 完全一致，生产构建不得引用

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
import type {
  BotSseEvent,
  ChatAccepted,
  ModelsResponse,
  ModelRef,
  OAuthStart,
  OAuthStatus,
  PiMessage,
  PiModel,
  ProviderInfo,
  SessionDetail,
  SessionStats,
  SessionSummary,
  ThinkingLevel,
} from './types';
import { emptySessionStats } from './types';
import { normalizeBot, toModelInfo } from './normalize';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const MOCK_MODELS: PiModel[] = [
  {
    provider: 'deepseek',
    id: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    contextWindow: 128000,
    reasoning: true,
    input: ['text'],
    hasAuth: true,
  },
  {
    provider: 'deepseek',
    id: 'deepseek-flash',
    name: 'DeepSeek Flash',
    contextWindow: 128000,
    reasoning: false,
    input: ['text'],
    hasAuth: true,
  },
  {
    provider: 'anthropic',
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    contextWindow: 200000,
    reasoning: true,
    input: ['text', 'image'],
    hasAuth: false,
  },
  {
    provider: 'openai',
    id: 'gpt-4o',
    name: 'GPT-4o',
    contextWindow: 128000,
    reasoning: false,
    input: ['text', 'image'],
    hasAuth: false,
  },
];

function defaultSettings(): Settings {
  return {
    language: 'zh-CN',
    theme: 'auto',
    memoryBackend: 'respire',
    memoryReview: false,
    maxSessions: 16,
    idleTimeoutMinutes: 10,
    defaultModel: { provider: 'deepseek', id: 'deepseek-v4-pro' },
    defaultThinking: 'medium',
    loadUserExtensions: false,
    loadContextFiles: false,
    timezone: 'UTC',
    workdir: '',
    toolDisplay: 'collapsed',
  };
}

export class MockApiClient implements ApiClient {
  private bots: Map<string, Bot> = new Map();
  private groups: Map<string, Group> = new Map();
  private groupMessages: Map<string, Message[]> = new Map();
  private memory: Map<string, MemoryEntry> = new Map();
  private tasks: Map<string, ScheduledTask> = new Map();
  private secrets: Map<string, Secret> = new Map();
  private settings: Settings;
  private sessions: Map<string, SessionDetail> = new Map();
  private botSessions: Map<string, string[]> = new Map();
  private activeSession: Map<string, string> = new Map();
  private providers: ProviderInfo[];
  private oauthFlows: Map<string, OAuthStatus> = new Map();
  private eventListeners = new Set<(event: BotSseEvent) => void>;
  private usage: UsageStats;

  constructor() {
    this.settings = defaultSettings();
    this.providers = [
      { id: 'deepseek', name: 'DeepSeek', authType: 'apiKey', configured: true, source: 'auth.json' },
      { id: 'anthropic', name: 'Anthropic', authType: 'both', configured: false, source: null },
      { id: 'openai', name: 'OpenAI', authType: 'apiKey', configured: false, source: null },
      { id: 'google', name: 'Google', authType: 'oauth', configured: false, source: null },
    ];
    this.usage = {
      period: 'week',
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
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
        'deepseek/deepseek-v4-pro': {
          inputTokens: 20700,
          outputTokens: 14400,
          cacheReadTokens: 77000,
          cacheWriteTokens: 3500,
          cost: 1.47,
        },
      },
      total: {
        inputTokens: 20700,
        outputTokens: 14400,
        cacheReadTokens: 77000,
        cacheWriteTokens: 3500,
        cost: 1.47,
      },
    };
    this.initializeMockData();
  }

  private emit(event: BotSseEvent) {
    for (const listener of this.eventListeners) listener(event);
  }

  private sessionKey(botId: string, sessionId: string) {
    return `${botId}:${sessionId}`;
  }

  private getDetail(botId: string, sessionId: string): SessionDetail {
    const detail = this.sessions.get(this.sessionKey(botId, sessionId));
    if (!detail) throw new ApiError(404, 'Session not found');
    return detail;
  }

  private seedSession(botId: string, name: string, messages: PiMessage[] = []): SessionDetail {
    const now = new Date().toISOString();
    const id = `ses-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const detail: SessionDetail = {
      session: {
        id,
        name,
        createdAt: now,
        updatedAt: now,
        messageCount: messages.length,
        model: null,
        thinking: null,
        isActive: true,
      },
      messages,
      stats: emptySessionStats(),
    };
    const ids = this.botSessions.get(botId) ?? [];
    for (const existing of ids) {
      const item = this.sessions.get(this.sessionKey(botId, existing));
      if (item) item.session.isActive = false;
    }
    ids.unshift(id);
    this.botSessions.set(botId, ids);
    this.sessions.set(this.sessionKey(botId, id), detail);
    this.activeSession.set(botId, id);
    return detail;
  }

  private initializeMockData() {
    const chief: Bot = {
      id: 'bot-chief',
      name: 'Chief',
      role: 'Main Bot',
      instructions: '你是团队的主要协调者，负责管理其他 Bot 和处理复杂任务。',
      model: null,
      thinking: null,
      look: { avatar: '🤖', color: '#3b82f6' },
      isMain: true,
      created: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      segments: [],
    };
    const writer: Bot = {
      id: 'bot-writer',
      name: 'Writer',
      role: 'Content Creator',
      instructions: '你是专业的内容创作者，擅长撰写文章、文档和创意内容。',
      model: { provider: 'deepseek', id: 'deepseek-flash' },
      thinking: 'low',
      look: { avatar: '✍️', color: '#10b981' },
      isMain: false,
      created: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      segments: [],
    };
    this.bots.set(chief.id, chief);
    this.bots.set(writer.id, writer);

    this.seedSession('bot-chief', '欢迎', [
      {
        id: 'msg-1',
        role: 'user',
        content: '你好，请介绍一下自己。',
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: '你好！我是 Chief，团队的主要协调者。我可以帮助你管理其他 Bot、创建群聊、安排任务等。',
        timestamp: new Date(Date.now() - 59 * 60 * 1000).toISOString(),
        thinking: '用户在打招呼，用简洁中文自我介绍即可。',
      },
    ]);
    const chiefActive = this.activeSession.get('bot-chief')!;
    const chiefDetail = this.getDetail('bot-chief', chiefActive);
    chiefDetail.stats = {
      tokens: { input: 420, output: 180, cacheRead: 1200, cacheWrite: 80, total: 1880 },
      cost: 0.012,
      contextUsage: { tokens: 1880, contextWindow: 128000, percent: 1.5 },
    };

    this.seedSession('bot-writer', '草稿');

    this.memory.set('mem-1', {
      id: 'mem-1',
      content: '用户偏好简洁的回答风格',
      title: '用户偏好',
      scope: 'team',
      importance: 'important',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: { source: 'conversation', by: 'Chief' },
    });

    this.tasks.set('task-1', {
      id: 'task-1',
      name: '每日总结',
      targetType: 'bot',
      targetId: 'bot-chief',
      message: '生成今天的工作总结',
      schedule: { type: 'daily', time: '18:00' },
      enabled: true,
      nextRun: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });

    this.secrets.set('GITHUB_TOKEN', {
      name: 'GITHUB_TOKEN',
      purpose: '访问 GitHub API',
      scope: ['bot-chief'],
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  async ping(): Promise<{ status: 'ok'; version: string }> {
    await delay(30);
    return { status: 'ok', version: '0.1.0-beta.7' };
  }

  async getBots(): Promise<Bot[]> {
    await delay(80);
    return Array.from(this.bots.values()).map(normalizeBot);
  }

  async getBot(id: string): Promise<Bot> {
    await delay(40);
    const bot = this.bots.get(id);
    if (!bot) throw new ApiError(404, 'Bot not found');
    return normalizeBot(bot);
  }

  async createBot(data: CreateBotRequest): Promise<Bot> {
    await delay(80);
    const bot: Bot = {
      id: `bot-${Date.now()}`,
      name: data.name,
      role: data.role,
      instructions: data.instructions,
      model: data.model ?? null,
      thinking: data.thinking ?? null,
      look: data.look,
      isMain: data.isMain || false,
      created: new Date().toISOString(),
      segments: [],
    };
    this.bots.set(bot.id, bot);
    this.seedSession(bot.id, '新会话');
    return normalizeBot(bot);
  }

  async updateBot(id: string, data: UpdateBotRequest): Promise<Bot> {
    await delay(60);
    const bot = this.bots.get(id);
    if (!bot) throw new ApiError(404, 'Bot not found');
    const updated: Bot = {
      ...bot,
      ...data,
      model: data.model === undefined ? bot.model : data.model,
    };
    this.bots.set(id, updated);
    return normalizeBot(updated);
  }

  async deleteBot(id: string): Promise<void> {
    await delay(60);
    const bot = this.bots.get(id);
    if (!bot) throw new ApiError(404, 'Bot not found');
    if (bot.isMain) throw new ApiError(400, 'Cannot delete main bot');
    this.bots.delete(id);
  }

  async getChatHistory(botId: string, limit = 50): Promise<Message[]> {
    await delay(40);
    const sid = this.activeSession.get(botId);
    if (!sid) return [];
    return this.getDetail(botId, sid).messages.slice(-limit).map((m) => ({
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

  streamChat(botId: string, onEvent: (event: StreamEvent) => void, content?: string): () => void {
    let cancelled = false;
    const stop = this.subscribeEvents((event) => {
      if (cancelled || (event.botId && event.botId !== botId)) return;
      if (event.type === 'bot.text_delta') onEvent({ type: 'text_delta', content: event.delta });
      if (event.type === 'bot.message_start') onEvent({ type: 'message_start', messageId: event.messageId });
      if (event.type === 'bot.turn_end') onEvent({ type: 'agent_settled' });
      if (event.type === 'bot.error') onEvent({ type: 'error', content: event.error });
    });
    void this.sendChat(botId, content ?? '你好');
    return () => {
      cancelled = true;
      stop();
    };
  }

  async sendChat(botId: string, message: string, sessionId?: string): Promise<ChatAccepted> {
    const bot = this.bots.get(botId);
    if (!bot) throw new ApiError(404, 'Bot not found');
    const sid = sessionId || this.activeSession.get(botId) || this.seedSession(botId, '新会话').session.id;
    const detail = this.getDetail(botId, sid);
    const runId = `run-${Date.now()}`;
    const userMsg: PiMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    detail.messages.push(userMsg);
    detail.session.messageCount = detail.messages.length;
    detail.session.updatedAt = userMsg.timestamp!;

    const assistantId = `msg-${Date.now()}-a`;
    const lower = message.toLowerCase();
    const unauth = /no api key|undefined|未登录|anthropic|openai/.test(lower) && /key|auth|登录/.test(lower);
    const missingProvider = /anthropic|openai|google/.exec(lower)?.[0] ?? 'anthropic';

    void (async () => {
      const emit = (partial: Partial<BotSseEvent> & { type: BotSseEvent['type'] }) => {
        this.emit({ botId, sessionId: sid, runId, ...partial });
      };
      await delay(80);
      emit({ type: 'bot.message_start', messageId: assistantId });
      if (unauth) {
        emit({
          type: 'bot.error',
          error: `No API key found for ${missingProvider}.`,
        });
        detail.messages.push({
          id: assistantId,
          role: 'assistant',
          content: '',
          error: `No API key found for ${missingProvider}.`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const thinking = '先确认用户意图，再调用工具收集信息，最后给出简洁回答。';
      for (const ch of thinking) {
        emit({ type: 'bot.thinking_delta', delta: ch, messageId: assistantId });
        await delay(8);
      }

      const args = { path: 'README.md' };
      emit({ type: 'bot.tool_start', toolCallId: 'tool-1', toolName: 'read', args });
      await delay(40);
      emit({ type: 'bot.tool_update', toolCallId: 'tool-1', toolName: 'read', args, result: '正在读取文件…' });
      await delay(40);
      emit({
        type: 'bot.tool_end',
        toolCallId: 'tool-1',
        toolName: 'read',
        args,
        result: '# pi-bot\nMulti-bot daemon',
        isError: false,
      });

      const reply = '这是一段**模拟流式**回复，包含 `code` 与工具调用。\n\n```ts\nconsole.log("hello pi-bot");\n```\n';
      for (const ch of reply) {
        emit({ type: 'bot.text_delta', delta: ch, messageId: assistantId });
        await delay(6);
      }

      const stats: SessionStats = {
        tokens: { input: 320, output: 140, cacheRead: 900, cacheWrite: 40, total: 1400 },
        cost: 0.008,
        contextUsage: { tokens: 2400, contextWindow: 128000, percent: 1.9 },
      };
      detail.stats = stats;
      emit({ type: 'bot.stats', stats });
      emit({ type: 'bot.message_end', messageId: assistantId, text: reply });
      emit({ type: 'bot.turn_end' });
      detail.messages.push({
        id: assistantId,
        role: 'assistant',
        content: reply,
        thinking,
        toolCalls: [
          {
            id: 'tool-1',
            name: 'read',
            arguments: args,
            result: '# pi-bot\nMulti-bot daemon',
            status: 'success',
          },
        ],
        timestamp: new Date().toISOString(),
      });
      detail.session.messageCount = detail.messages.length;
      detail.session.updatedAt = new Date().toISOString();
    })();

    return { sessionId: sid, runId };
  }

  async abortChat(_botId: string, _sessionId?: string): Promise<void> {
    await delay(20);
  }

  subscribeEvents(onEvent: (event: BotSseEvent) => void): () => void {
    this.eventListeners.add(onEvent);
    return () => this.eventListeners.delete(onEvent);
  }

  async getModels(): Promise<ModelsResponse> {
    await delay(40);
    return {
      models: MOCK_MODELS.map((m) => ({
        ...m,
        hasAuth: this.providers.find((p) => p.id === m.provider)?.configured ?? m.hasAuth,
      })),
      defaultModel: this.settings.defaultModel,
      defaultThinking: this.settings.defaultThinking,
    };
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    const { models } = await this.getModels();
    return models.map(toModelInfo);
  }

  async getProviders(): Promise<ProviderInfo[]> {
    await delay(40);
    return this.providers.map((p) => ({ ...p }));
  }

  async setProviderApiKey(id: string, apiKey: string): Promise<{ configured: true }> {
    await delay(40);
    if (!apiKey.trim()) throw new ApiError(400, 'apiKey is required');
    const provider = this.providers.find((p) => p.id === id);
    if (!provider) throw new ApiError(404, 'Provider not found');
    provider.configured = true;
    provider.source = 'auth.json';
    return { configured: true };
  }

  async deleteProviderAuth(id: string): Promise<void> {
    await delay(30);
    const provider = this.providers.find((p) => p.id === id);
    if (!provider) throw new ApiError(404, 'Provider not found');
    provider.configured = false;
    provider.source = null;
  }

  async startProviderOAuth(id: string): Promise<OAuthStart> {
    await delay(30);
    const provider = this.providers.find((p) => p.id === id);
    if (!provider || (provider.authType !== 'oauth' && provider.authType !== 'both')) {
      throw new ApiError(400, 'OAuth not supported');
    }
    const flowId = `flow-${Date.now()}`;
    this.oauthFlows.set(flowId, { status: 'pending' });
    setTimeout(() => {
      const flow = this.oauthFlows.get(flowId);
      if (flow && flow.status === 'pending') {
        this.oauthFlows.set(flowId, { status: 'done' });
        provider.configured = true;
        provider.source = 'auth.json';
      }
    }, 400);
    return { url: `https://example.test/oauth/${id}?flow=${flowId}`, flowId };
  }

  async getProviderOAuthStatus(_id: string, flowId: string): Promise<OAuthStatus> {
    await delay(20);
    return this.oauthFlows.get(flowId) ?? { status: 'error', error: 'Unknown flow' };
  }

  async listSessions(botId: string): Promise<SessionSummary[]> {
    await delay(40);
    const ids = this.botSessions.get(botId) ?? [];
    return ids.map((id) => this.getDetail(botId, id).session);
  }

  async createSession(botId: string, name?: string): Promise<SessionSummary> {
    await delay(40);
    if (!this.bots.has(botId)) throw new ApiError(404, 'Bot not found');
    return this.seedSession(botId, name || '新会话').session;
  }

  async getSession(botId: string, sessionId: string): Promise<SessionDetail> {
    await delay(40);
    const detail = this.getDetail(botId, sessionId);
    return {
      session: { ...detail.session },
      messages: detail.messages.map((m) => ({ ...m })),
      stats: { ...detail.stats, tokens: { ...detail.stats.tokens } },
    };
  }

  async updateSession(
    botId: string,
    sessionId: string,
    data: { name?: string; model?: ModelRef | null; thinking?: ThinkingLevel | null }
  ): Promise<SessionSummary> {
    await delay(30);
    const detail = this.getDetail(botId, sessionId);
    if (data.name !== undefined) detail.session.name = data.name;
    if (data.model !== undefined) detail.session.model = data.model;
    if (data.thinking !== undefined) detail.session.thinking = data.thinking;
    detail.session.updatedAt = new Date().toISOString();
    return { ...detail.session };
  }

  async activateSession(botId: string, sessionId: string): Promise<SessionSummary> {
    await delay(20);
    const ids = this.botSessions.get(botId) ?? [];
    for (const id of ids) {
      const item = this.sessions.get(this.sessionKey(botId, id));
      if (item) item.session.isActive = id === sessionId;
    }
    this.activeSession.set(botId, sessionId);
    return { ...this.getDetail(botId, sessionId).session };
  }

  async forkSession(botId: string, sessionId: string, entryId: string): Promise<SessionSummary> {
    await delay(40);
    const source = this.getDetail(botId, sessionId);
    const cut = source.messages.findIndex((m) => m.id === entryId);
    const copied = source.messages.slice(0, cut >= 0 ? cut + 1 : source.messages.length).map((m) => ({ ...m }));
    const forked = this.seedSession(botId, `${source.session.name} (分支)`, copied);
    forked.stats = { ...source.stats, tokens: { ...source.stats.tokens } };
    return forked.session;
  }

  async deleteSession(botId: string, sessionId: string): Promise<void> {
    await delay(30);
    this.getDetail(botId, sessionId);
    this.sessions.delete(this.sessionKey(botId, sessionId));
    const ids = (this.botSessions.get(botId) ?? []).filter((id) => id !== sessionId);
    this.botSessions.set(botId, ids);
    if (this.activeSession.get(botId) === sessionId) {
      this.activeSession.set(botId, ids[0] ?? '');
      if (ids[0]) this.getDetail(botId, ids[0]).session.isActive = true;
    }
  }

  async getGroups(): Promise<Group[]> {
    await delay(40);
    return Array.from(this.groups.values());
  }

  async getGroup(id: string): Promise<Group> {
    const group = this.groups.get(id);
    if (!group) throw new ApiError(404, 'Group not found');
    return group;
  }

  async createGroup(data: CreateGroupRequest): Promise<Group> {
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
    const group = this.groups.get(id);
    if (!group) throw new ApiError(404, 'Group not found');
    const updated: Group = {
      ...group,
      ...data,
      admin: data.admin === undefined ? group.admin : Array.isArray(data.admin) ? data.admin : [data.admin],
    };
    this.groups.set(id, updated);
    return updated;
  }

  async deleteGroup(id: string): Promise<void> {
    if (!this.groups.has(id)) throw new ApiError(404, 'Group not found');
    this.groups.delete(id);
  }

  async getGroupMessages(id: string, limit = 50): Promise<Message[]> {
    return (this.groupMessages.get(id) || []).slice(-limit);
  }

  async postToGroup(id: string, message: string): Promise<void> {
    const messages = this.groupMessages.get(id) || [];
    messages.push({
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    });
    this.groupMessages.set(id, messages);
  }

  async getMemoryStatus(): Promise<MemoryStatus> {
    return { available: true };
  }

  async searchMemory(data: MemorySearchRequest): Promise<MemoryEntry[]> {
    let entries = Array.from(this.memory.values());
    if (data.scope && data.scope !== 'all') entries = entries.filter((e) => e.scope === data.scope);
    if (data.query) {
      const query = data.query.toLowerCase();
      entries = entries.filter((e) => e.content.toLowerCase().includes(query) || e.title?.toLowerCase().includes(query));
    }
    return entries.slice(0, data.limit || 20);
  }

  async getMemoryEntry(id: string): Promise<MemoryEntry> {
    const entry = this.memory.get(id);
    if (!entry) throw new ApiError(404, 'Memory entry not found');
    return entry;
  }

  async writeMemory(botId: string, data: MemoryWriteRequest): Promise<MemoryEntry> {
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
    const entry = this.memory.get(id);
    if (!entry) throw new ApiError(404, 'Memory entry not found');
    const updated = { ...entry, content, updatedAt: new Date().toISOString() };
    this.memory.set(id, updated);
    return updated;
  }

  async forgetMemory(id: string): Promise<void> {
    if (!this.memory.has(id)) throw new ApiError(404, 'Memory entry not found');
    this.memory.delete(id);
  }

  async getMemorySummary(scope: 'bot' | 'team', botId?: string): Promise<string> {
    const entries = Array.from(this.memory.values()).filter((e) => {
      if (scope === 'bot' && e.botId !== botId) return false;
      if (scope === 'team' && e.scope !== 'team') return false;
      return true;
    });
    if (entries.length === 0) return '暂无记忆条目。';
    return `共有 ${entries.length} 条记忆。主要包括用户偏好、工作流程和团队规范等内容。`;
  }

  async getTasks(): Promise<ScheduledTask[]> {
    return Array.from(this.tasks.values());
  }

  async getTask(id: string): Promise<ScheduledTask> {
    const task = this.tasks.get(id);
    if (!task) throw new ApiError(404, 'Task not found');
    return task;
  }

  async createTask(data: CreateScheduleRequest): Promise<ScheduledTask> {
    const task: ScheduledTask = { id: `task-${Date.now()}`, ...data, enabled: true };
    this.tasks.set(task.id, task);
    return task;
  }

  async updateTask(id: string, data: Partial<CreateScheduleRequest>): Promise<ScheduledTask> {
    const task = this.tasks.get(id);
    if (!task) throw new ApiError(404, 'Task not found');
    const updated = { ...task, ...data };
    this.tasks.set(id, updated);
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    if (!this.tasks.has(id)) throw new ApiError(404, 'Task not found');
    this.tasks.delete(id);
  }

  async toggleTask(id: string, enabled: boolean): Promise<ScheduledTask> {
    const task = this.tasks.get(id);
    if (!task) throw new ApiError(404, 'Task not found');
    const updated = { ...task, enabled };
    this.tasks.set(id, updated);
    return updated;
  }

  async getSecrets(): Promise<Secret[]> {
    return Array.from(this.secrets.values());
  }

  async requestSecret(data: RequestSecretRequest): Promise<void> {
    this.secrets.set(data.name, {
      name: data.name,
      purpose: data.purpose,
      scope: [],
      createdAt: new Date().toISOString(),
    });
  }

  async revokeSecret(name: string, botId: string): Promise<void> {
    const secret = this.secrets.get(name);
    if (!secret) throw new ApiError(404, 'Secret not found');
    secret.scope = secret.scope.filter((id) => id !== botId);
    if (secret.scope.length === 0) this.secrets.delete(name);
  }

  async getUsageStats(period: 'day' | 'week' | 'month', startDate?: string): Promise<UsageStats> {
    return { ...this.usage, period, startDate: startDate || this.usage.startDate };
  }

  async getSettings(): Promise<Settings> {
    return { ...this.settings };
  }

  async updateSettings(data: Partial<Settings>): Promise<Settings> {
    this.settings = { ...this.settings, ...data };
    return { ...this.settings };
  }
}
