/**
 * Session pool: manages bot AgentSessions via shared pi SDK services.
 *
 * Session files live under ~/.pi-bot/sessions/<botId>/ with cwd = bot workdir.
 * createAgentSessionServices is created once and reused across bots.
 */

import { EventEmitter } from 'node:events';
import { mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  createAgentSessionFromServices,
  SessionManager,
  type AgentSessionServices,
} from '@earendil-works/pi-coding-agent';
import type {
  BotConfig,
  BotSseEvent,
  ChatSessionDetail,
  ChatSessionSummary,
  PatchSessionRequest,
  SessionStats,
  ThinkingLevel,
} from '#shared/index.js';
import { normalizeBotModel, normalizeThinking, resolveModel } from '../models/resolve.js';
import { errorEvent, extractText, mapSessionEvent, statsEvent } from './events.js';
import { SessionIndexStore } from './index-store.js';
import { getSharedAgentServices, servicesForCwd } from './services.js';
import { emptyStats, modelFromProjection, statsFromEntries, statsFromSdk } from './stats.js';
import type {
  SessionPoolConfig,
  SessionPoolStats,
  SessionInfo,
  SessionEvent,
  DeliveryOptions,
  StartChatOptions,
  BotSession,
} from './types.js';
import {
  MAX_HOPS,
  createPibotContext,
  createPibotPromptExtension,
  createPibotToolDefinitions,
  type PibotHost,
} from '../pibot-tools/index.js';

function newSessionId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

export class SessionPool extends EventEmitter {
  private runtimes = new Map<string, BotSession>();
  private config: SessionPoolConfig;
  private idleTimers = new Map<string, NodeJS.Timeout>();
  private index: SessionIndexStore;
  private services: AgentSessionServices | undefined;
  private pibotHost: PibotHost | undefined;
  private currentToolCtx: { botId: string; sessionId: string } | null = null;
  private pendingMeta = new Set<Promise<void>>();

  constructor(config: SessionPoolConfig) {
    super();
    this.config = config;
    this.index = new SessionIndexStore(config.sessionDir);
    this.services = config.services;
    this.pibotHost = config.pibotHost;
  }

  setHost(host: PibotHost): void {
    this.pibotHost = host;
  }

  private runtimeKey(botId: string, sessionId: string): string {
    return `${botId}:${sessionId}`;
  }

  botWorkdir(botId: string): string {
    const root = this.config.workspaceDir ?? join(this.config.sessionDir, '..', 'workspace');
    return join(root, botId);
  }

  botSessionDir(botId: string): string {
    return join(this.config.sessionDir, botId);
  }

  async getServices(): Promise<AgentSessionServices> {
    if (this.config.services) return this.config.services;
    if (this.services && this.config.modelRuntime) return this.services;
    // Re-read C's singleton each time so OAuth / API-key invalidate is picked up.
    const services = await getSharedAgentServices({
      cwd: this.config.workspaceDir ?? this.config.sessionDir,
      loadUserExtensions: this.config.loadUserExtensions ?? false,
      loadContextFiles: this.config.loadContextFiles ?? false,
      agentDir: this.config.agentDir,
      modelRuntime: this.config.modelRuntime,
      extensionFactories: [createPibotPromptExtension(() => this.liveToolContext())],
    });
    this.services = services;
    return services;
  }

  /**
   * Get or create the active session runtime for a bot.
   */
  async getSession(bot: BotConfig): Promise<BotSession> {
    const sessionId = await this.ensureActiveSessionId(bot);
    return this.ensureRuntime(bot, sessionId);
  }

  async ensureActiveSessionId(bot: BotConfig): Promise<string> {
    const index = await this.index.load(bot.id);
    if (index.activeId && index.sessions[index.activeId]) {
      return index.activeId;
    }
    const created = await this.createBotSession(bot);
    return created.id;
  }

  async listBotSessions(bot: BotConfig): Promise<ChatSessionSummary[]> {
    const cwd = this.botWorkdir(bot.id);
    const sessionDir = this.botSessionDir(bot.id);
    await mkdir(sessionDir, { recursive: true });
    await mkdir(cwd, { recursive: true });

    const index = await this.index.load(bot.id);
    const listed = await SessionManager.list(cwd, sessionDir).catch(() => []);

    const byId = new Map<string, ChatSessionSummary>();

    for (const meta of Object.values(index.sessions)) {
      byId.set(meta.id, {
        id: meta.id,
        name: meta.name,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        messageCount: meta.messageCount ?? 0,
        model: meta.model ?? normalizeBotModel(bot.model),
        thinking: meta.thinking ?? normalizeThinking(bot.thinking) ?? null,
        isActive: index.activeId === meta.id,
      });
    }

    for (const info of listed) {
      const existing = byId.get(info.id);
      const opened = this.readSessionMeta(cwd, sessionDir, info.path, info.id);
      const listedUpdated = (info.modified ?? new Date()).toISOString();
      const updatedAt =
        existing && existing.updatedAt > listedUpdated ? existing.updatedAt : listedUpdated;
      byId.set(info.id, {
        id: info.id,
        name: existing?.name ?? info.name,
        createdAt: existing?.createdAt ?? (info.created ?? new Date()).toISOString(),
        updatedAt,
        messageCount: Math.max(info.messageCount ?? 0, existing?.messageCount ?? 0),
        model: opened.model ?? existing?.model ?? normalizeBotModel(bot.model),
        thinking: opened.thinking ?? existing?.thinking ?? normalizeThinking(bot.thinking) ?? null,
        isActive: index.activeId === info.id,
      });
    }

    for (const summary of byId.values()) {
      const live = this.runtimes.get(this.runtimeKey(bot.id, summary.id));
      if (!live) continue;
      summary.messageCount = Math.max(summary.messageCount, live.info.messageCount);
      const liveUpdated = new Date(live.info.lastActive).toISOString();
      if (liveUpdated > summary.updatedAt) summary.updatedAt = liveUpdated;
    }

    return Array.from(byId.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createBotSession(bot: BotConfig, name?: string): Promise<ChatSessionSummary> {
    const id = newSessionId();
    const now = new Date().toISOString();
    const thinking = normalizeThinking(bot.thinking);
    const model = normalizeBotModel(bot.model);
    const summary: ChatSessionSummary = {
      id,
      name: name ?? bot.name,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      model,
      thinking,
      isActive: true,
    };

    await this.index.upsert(
      bot.id,
      {
        id,
        name: summary.name,
        createdAt: now,
        updatedAt: now,
        messageCount: 0,
        model,
        thinking,
      },
      true
    );

    this.emit('session_created', {
      type: 'session_created',
      botId: bot.id,
      sessionId: id,
      session: summary,
    } as SessionEvent);

    return summary;
  }

  async getBotSession(bot: BotConfig, sessionId: string): Promise<ChatSessionDetail> {
    const summaries = await this.listBotSessions(bot);
    const summary = summaries.find((s) => s.id === sessionId);
    if (!summary) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const live = this.runtimes.get(this.runtimeKey(bot.id, sessionId));
    if (live) {
      const projection = live.session.sessionManager.buildSessionContext();
      return {
        session: {
          ...summary,
          messageCount: projection.messages.length,
          model: modelFromProjection(projection.model) ?? summary.model,
          thinking: (projection.thinkingLevel as ThinkingLevel | undefined) ?? summary.thinking,
        },
        messages: projection.messages,
        stats: this.liveStats(live),
      };
    }

    const cwd = this.botWorkdir(bot.id);
    const sessionDir = this.botSessionDir(bot.id);
    const file = SessionManager.findById(cwd, sessionId, sessionDir);
    if (!file) {
      return { session: summary, messages: [], stats: emptyStats() };
    }

    const manager = SessionManager.open(file, sessionDir, cwd);
    const projection = manager.buildSessionContext();
    return {
      session: {
        ...summary,
        messageCount: projection.messages.length,
        model: modelFromProjection(projection.model) ?? summary.model,
        thinking: (projection.thinkingLevel as ThinkingLevel | undefined) ?? summary.thinking,
      },
      messages: projection.messages,
      stats: statsFromEntries(manager.getEntries()),
    };
  }

  async patchBotSession(
    bot: BotConfig,
    sessionId: string,
    patch: PatchSessionRequest
  ): Promise<ChatSessionSummary> {
    const current = await this.getBotSession(bot, sessionId);
    const needsRuntime = Boolean(patch.model || patch.thinking);
    const live = this.runtimes.get(this.runtimeKey(bot.id, sessionId));
    const runtime = needsRuntime ? await this.ensureRuntime(bot, sessionId) : live;

    if (patch.name !== undefined) {
      runtime?.session.setSessionName(patch.name);
    }
    if (patch.model && runtime) {
      const services = await this.getServices();
      const model = await resolveModel({ model: patch.model }, services.modelRuntime, services.settingsManager);
      if (model) {
        await runtime.session.setModel(model);
      }
    }
    if (patch.thinking !== undefined && patch.thinking !== null && runtime) {
      runtime.session.setThinkingLevel(patch.thinking);
    }

    const now = new Date().toISOString();
    const next: ChatSessionSummary = {
      ...current.session,
      name: patch.name ?? current.session.name,
      model: patch.model === undefined ? current.session.model : patch.model,
      thinking: patch.thinking === undefined ? current.session.thinking : patch.thinking,
      updatedAt: now,
    };

    await this.index.upsert(bot.id, {
      id: sessionId,
      name: next.name,
      createdAt: next.createdAt,
      updatedAt: now,
      model: next.model,
      thinking: next.thinking,
    });

    return next;
  }

  async activateBotSession(bot: BotConfig, sessionId: string): Promise<ChatSessionSummary> {
    const detail = await this.getBotSession(bot, sessionId);
    await this.index.setActive(bot.id, sessionId);
    return { ...detail.session, isActive: true };
  }

  async forkBotSession(bot: BotConfig, sessionId: string, entryId: string): Promise<ChatSessionSummary> {
    const cwd = this.botWorkdir(bot.id);
    const sessionDir = this.botSessionDir(bot.id);
    await mkdir(cwd, { recursive: true });
    await mkdir(sessionDir, { recursive: true });

    const sourcePath = SessionManager.findById(cwd, sessionId, sessionDir);
    if (!sourcePath) {
      throw new Error(`Cannot fork session ${sessionId}: no persisted file yet`);
    }

    const forked = SessionManager.forkFrom(sourcePath, cwd, sessionDir, { id: newSessionId() });
    if (entryId && entryId !== 'head' && entryId !== 'latest') {
      forked.branch(entryId);
    }

    const id = forked.getSessionId();
    const now = new Date().toISOString();
    const projection = forked.buildSessionContext();
    const summary: ChatSessionSummary = {
      id,
      name: `${forked.getSessionName() ?? bot.name} (fork)`,
      createdAt: now,
      updatedAt: now,
      messageCount: projection.messages.length,
      model: modelFromProjection(projection.model) ?? normalizeBotModel(bot.model),
      thinking: (projection.thinkingLevel as ThinkingLevel | undefined) ?? normalizeThinking(bot.thinking),
      isActive: true,
    };

    await this.index.upsert(
      bot.id,
      {
        id,
        name: summary.name,
        createdAt: now,
        updatedAt: now,
        model: summary.model,
        thinking: summary.thinking,
      },
      true
    );

    return summary;
  }

  async deleteBotSession(bot: BotConfig, sessionId: string): Promise<void> {
    await this.destroyRuntime(bot.id, sessionId);

    const cwd = this.botWorkdir(bot.id);
    const sessionDir = this.botSessionDir(bot.id);
    const file = SessionManager.findById(cwd, sessionId, sessionDir);
    if (file) {
      await unlink(file).catch(() => undefined);
    }

    await this.index.remove(bot.id, sessionId);
  }

  /**
   * Accept a chat turn: subscribe first, return ids immediately, prompt in background.
   */
  async startChat(
    bot: BotConfig,
    message: string,
    sessionId?: string,
    options: StartChatOptions = {}
  ): Promise<{ sessionId: string; runId: string }> {
    const sid = sessionId ?? (await this.ensureActiveSessionId(bot));
    if (sessionId) {
      await this.index.setActive(bot.id, sid);
    }

    const hop = options.hop ?? 0;
    if (hop > MAX_HOPS) {
      throw new Error(`Message hop limit exceeded (${MAX_HOPS})`);
    }

    const runtime = await this.ensureRuntime(bot, sid, hop);
    const runId = randomUUID();
    runtime.runId = runId;
    runtime.info.hop = hop;
    this.touchRuntime(bot.id, sid);
    this.currentToolCtx = { botId: bot.id, sessionId: sid };
    void this.bumpSessionMeta(bot.id, sid);

    // Subscription is installed in ensureRuntime BEFORE prompt.
    void runtime.session.prompt(message).catch((error) => {
      const event = errorEvent(
        { botId: bot.id, sessionId: sid, runId },
        error instanceof Error ? error.message : String(error)
      );
      this.emitBotEvent(event);
    });

    return { sessionId: sid, runId };
  }

  async abort(botId: string, sessionId?: string): Promise<boolean> {
    const runtime = sessionId
      ? this.runtimes.get(this.runtimeKey(botId, sessionId))
      : this.findRuntimeForBot(botId);
    if (!runtime) return false;
    await runtime.session.abort();
    return true;
  }

  /**
   * Send a message and wait for the turn (scheduler / team coordinator).
   */
  async sendMessage(
    _botId: string,
    message: string,
    bot: BotConfig,
    options: DeliveryOptions = {}
  ): Promise<void> {
    const hop = (options.hop ?? 0) + 1;
    if (hop > MAX_HOPS) {
      throw new Error(`Message hop limit exceeded (${MAX_HOPS})`);
    }

    const sid = options.sessionId ?? (await this.ensureActiveSessionId(bot));
    const runtime = await this.ensureRuntime(bot, sid, hop);
    runtime.info.hop = hop;

    let formattedMessage = message;
    if (options.from && options.from !== 'user') {
      formattedMessage = `[Message from ${options.from}]\n${message}`;
    }

    await runtime.session.prompt(formattedMessage);
  }

  async getLatestAssistantText(bot: BotConfig, sessionId: string): Promise<string> {
    const detail = await this.getBotSession(bot, sessionId);
    for (let i = detail.messages.length - 1; i >= 0; i--) {
      const message = detail.messages[i] as { role?: string };
      if (message?.role === 'assistant') {
        return extractText(message);
      }
    }
    return '';
  }

  async waitForAssistant(bot: BotConfig, sessionId: string, timeoutMs: number): Promise<string> {
    const live = this.runtimes.get(this.runtimeKey(bot.id, sessionId));
    const busy = live && (live.info.status === 'active' || live.info.status === 'settling');
    if (!busy) {
      const text = await this.getLatestAssistantText(bot, sessionId);
      if (text) return text;
    }

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        void this.getLatestAssistantText(bot, sessionId).then((text) => {
          if (text) resolve(text);
          else reject(new Error(`Timeout waiting for session ${sessionId}`));
        }, reject);
      }, timeoutMs);

      const onEvent = (payload: SessionEvent) => {
        if (payload.type !== 'bot_event') return;
        const ev = payload.event;
        if (ev.sessionId !== sessionId) return;
        if (ev.type === 'bot.turn_end') {
          cleanup();
          void this.getLatestAssistantText(bot, sessionId).then(resolve, reject);
        } else if (ev.type === 'bot.error') {
          cleanup();
          reject(new Error(String(ev.error ?? 'session error')));
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        this.off('bot_event', onEvent);
      };

      this.on('bot_event', onEvent);
    });
  }

  getSessionInfo(botId: string): SessionInfo | null {
    const runtime = this.findRuntimeForBot(botId);
    return runtime ? runtime.info : null;
  }

  listSessions(): SessionInfo[] {
    return Array.from(this.runtimes.values()).map((s) => s.info);
  }

  getStats(): SessionPoolStats {
    const sessions = Array.from(this.runtimes.values());
    return {
      active: sessions.filter((s) => s.info.status === 'active' || s.info.status === 'settling')
        .length,
      idle: sessions.filter((s) => s.info.status === 'idle').length,
      total: sessions.length,
      maxSessions: this.config.maxSessions,
    };
  }

  async destroySession(botId: string): Promise<void> {
    const keys = Array.from(this.runtimes.keys()).filter((k) => k.startsWith(`${botId}:`));
    await Promise.all(keys.map((key) => {
      const [, sid] = key.split(':');
      return this.destroyRuntime(botId, sid ?? '');
    }));
  }

  async destroy(): Promise<void> {
    await Promise.allSettled(this.pendingMeta);
    const keys = Array.from(this.runtimes.values());
    await Promise.all(keys.map((s) => this.destroyRuntime(s.botId, s.sessionId)));
    await Promise.allSettled(this.pendingMeta);
  }

  private liveToolContext() {
    if (!this.pibotHost) return undefined;
    const key = this.currentToolCtx;
    if (!key) return undefined;
    const live = this.runtimes.get(this.runtimeKey(key.botId, key.sessionId));
    return this.toolContextFor(key.botId, key.sessionId, live?.info.hop ?? 0);
  }

  private toolContextFor(botId: string, sessionId: string, fallbackHop: number) {
    if (!this.pibotHost) {
      throw new Error('pibot host not configured');
    }
    const ctx = createPibotContext(this.pibotHost, botId, sessionId, fallbackHop);
    Object.defineProperty(ctx, 'currentHop', {
      get: () => this.runtimes.get(this.runtimeKey(botId, sessionId))?.info.hop ?? fallbackHop,
      enumerable: true,
    });
    return ctx;
  }

  private async bumpSessionMeta(botId: string, sessionId: string): Promise<void> {
    const task = this.writeSessionMeta(botId, sessionId).catch((error) => {
      console.warn('[session] failed to persist session meta:', error);
    });
    this.pendingMeta.add(task);
    try {
      await task;
    } finally {
      this.pendingMeta.delete(task);
    }
  }

  private async writeSessionMeta(botId: string, sessionId: string): Promise<void> {
    const index = await this.index.load(botId);
    const meta = index.sessions[sessionId];
    if (!meta) return;
    const live = this.runtimes.get(this.runtimeKey(botId, sessionId));
    const now = new Date().toISOString();
    meta.updatedAt = now;
    meta.messageCount = live?.info.messageCount ?? meta.messageCount ?? 0;
    await this.index.save(botId, index);
    this.emit('session_updated', {
      type: 'session_updated',
      botId,
      sessionId,
      session: {
        id: sessionId,
        name: meta.name,
        createdAt: meta.createdAt,
        updatedAt: now,
        messageCount: meta.messageCount ?? 0,
        model: meta.model ?? null,
        thinking: meta.thinking ?? null,
        isActive: index.activeId === sessionId,
      },
    } as SessionEvent);
  }

  private findRuntimeForBot(botId: string): BotSession | undefined {
    for (const runtime of this.runtimes.values()) {
      if (runtime.botId === botId) return runtime;
    }
    return undefined;
  }

  private async ensureRuntime(bot: BotConfig, sessionId: string, hop = 0): Promise<BotSession> {
    const key = this.runtimeKey(bot.id, sessionId);
    const existing = this.runtimes.get(key);
    if (existing) {
      existing.info.hop = hop;
      this.touchRuntime(bot.id, sessionId);
      return existing;
    }

    if (this.runtimes.size >= this.config.maxSessions) {
      const evicted = this.evictOldestIdle();
      if (!evicted) {
        throw new Error(
          `Session pool at capacity (${this.config.maxSessions}), no idle sessions to evict`
        );
      }
    }

    return this.createRuntime(bot, sessionId, hop);
  }

  private async createRuntime(bot: BotConfig, sessionId: string, hop = 0): Promise<BotSession> {
    const cwd = this.botWorkdir(bot.id);
    const sessionDir = this.botSessionDir(bot.id);
    await mkdir(cwd, { recursive: true });
    await mkdir(sessionDir, { recursive: true });

    const shared = await this.getServices();
    const services = servicesForCwd(shared, cwd);
    const model = await resolveModel(bot, services.modelRuntime, services.settingsManager);
    const thinking = normalizeThinking(bot.thinking);

    const existingFile = SessionManager.findById(cwd, sessionId, sessionDir);
    const sessionManager = existingFile
      ? SessionManager.open(existingFile, sessionDir, cwd)
      : SessionManager.create(cwd, sessionDir, { id: sessionId });

    const customTools = this.pibotHost
      ? createPibotToolDefinitions(this.toolContextFor(bot.id, sessionId, hop))
      : [];

    const result = await createAgentSessionFromServices({
      services,
      sessionManager,
      ...(model ? { model } : {}),
      ...(thinking ? { thinkingLevel: thinking } : {}),
      ...(customTools.length ? { customTools } : {}),
    });

    const session = result.session;
    const indexMeta = (await this.index.load(bot.id)).sessions[sessionId];
    session.setSessionName(indexMeta?.name ?? bot.name);

    const now = Date.now();
    const botSession: BotSession = {
      botId: bot.id,
      sessionId,
      result,
      session,
      info: {
        botId: bot.id,
        sessionId,
        created: now,
        lastActive: now,
        status: 'idle',
        messageCount: 0,
        hop,
      },
    };

    // Subscribe BEFORE any prompt() so stream events are not dropped.
    this.subscribeToSession(botSession);

    this.runtimes.set(this.runtimeKey(bot.id, sessionId), botSession);
    this.startIdleTimer(bot.id, sessionId);

    this.emit('session_created', {
      type: 'session_created',
      botId: bot.id,
      sessionId,
    } as SessionEvent);

    return botSession;
  }

  private subscribeToSession(botSession: BotSession) {
    const { session, botId, sessionId } = botSession;
    let emittedTurnEnd = false;

    const unsubscribe = session.subscribe((event) => {
      const ctx = {
        botId,
        sessionId,
        runId: botSession.runId ?? 'idle',
      };

      switch (event.type) {
        case 'agent_start':
          emittedTurnEnd = false;
          botSession.info.status = 'active';
          this.emit('status_change', {
            type: 'status_change',
            botId,
            status: 'active',
          } as SessionEvent);
          break;

        case 'agent_end':
          botSession.info.status = 'settling';
          this.emit('status_change', {
            type: 'status_change',
            botId,
            status: 'settling',
          } as SessionEvent);
          break;

        case 'turn_end':
        case 'agent_settled':
          botSession.info.status = 'idle';
          this.emit('status_change', {
            type: 'status_change',
            botId,
            status: 'idle',
          } as SessionEvent);
          this.touchRuntime(botId, sessionId);
          if (!emittedTurnEnd) {
            emittedTurnEnd = true;
            for (const mapped of mapSessionEvent(event, ctx)) {
              this.emitBotEvent(mapped);
            }
            const stats = this.liveStats(botSession);
            this.emitBotEvent(statsEvent(ctx, stats));
            this.emit('usage', {
              botId,
              sessionId,
              stats,
              model: botSession.session.model,
            });
          }
          return;

        case 'message_end': {
          botSession.info.messageCount++;
          const text = extractText(event.message);
          void this.bumpSessionMeta(botId, sessionId);
          this.emit('message_end', {
            type: 'message_end',
            botId,
            messageId: sessionId,
            text,
          } as SessionEvent);
          break;
        }

        case 'tool_execution_start':
          this.emit('tool_call', {
            type: 'tool_call',
            botId,
            tool: event.toolName,
            args: event.args,
          } as SessionEvent);
          break;

        default:
          break;
      }

      for (const mapped of mapSessionEvent(event, ctx)) {
        this.emitBotEvent(mapped);
      }
    });

    botSession.unsubscribe = unsubscribe;
  }

  private emitBotEvent(event: BotSseEvent) {
    this.emit('bot_event', { type: 'bot_event', event } as SessionEvent);
    this.emit(event.type, event);
  }

  private liveStats(runtime: BotSession): SessionStats {
    try {
      const raw = runtime.session.getSessionStats();
      const context = runtime.session.getContextUsage();
      return statsFromSdk({
        tokens: raw.tokens,
        cost: raw.cost,
        contextUsage: context ?? raw.contextUsage,
      });
    } catch {
      return emptyStats();
    }
  }

  private readSessionMeta(
    cwd: string,
    sessionDir: string,
    path: string,
    _id: string
  ): { model: ChatSessionSummary['model']; thinking: ThinkingLevel | null } {
    try {
      const manager = SessionManager.open(path, sessionDir, cwd);
      const projection = manager.buildSessionContext();
      return {
        model: modelFromProjection(projection.model),
        thinking: (projection.thinkingLevel as ThinkingLevel | undefined) ?? null,
      };
    } catch {
      return { model: null, thinking: null };
    }
  }

  private async destroyRuntime(botId: string, sessionId: string): Promise<void> {
    const key = this.runtimeKey(botId, sessionId);
    const session = this.runtimes.get(key);
    if (!session) return;

    this.clearIdleTimer(key);
    this.runtimes.delete(key);
    try {
      session.unsubscribe?.();
      session.session.dispose();
    } catch (error) {
      console.error(`Failed to dispose session ${key}:`, error);
    }
    this.emit('session_destroyed', {
      type: 'session_destroyed',
      botId,
      sessionId,
    } as SessionEvent);
  }

  private touchRuntime(botId: string, sessionId: string) {
    const session = this.runtimes.get(this.runtimeKey(botId, sessionId));
    if (session) {
      session.info.lastActive = Date.now();
      this.restartIdleTimer(botId, sessionId);
    }
  }

  private startIdleTimer(botId: string, sessionId: string) {
    const key = this.runtimeKey(botId, sessionId);
    this.clearIdleTimer(key);

    const timer = setTimeout(() => {
      this.emit('session_idle', { type: 'session_idle', botId } as SessionEvent);
      void this.destroyRuntime(botId, sessionId);
    }, this.config.idleTimeoutMs);

    this.idleTimers.set(key, timer);
  }

  private restartIdleTimer(botId: string, sessionId: string) {
    this.startIdleTimer(botId, sessionId);
  }

  private clearIdleTimer(key: string) {
    const timer = this.idleTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.idleTimers.delete(key);
    }
  }

  private evictOldestIdle(): boolean {
    const idleSessions = Array.from(this.runtimes.values())
      .filter((s) => s.info.status === 'idle')
      .sort((a, b) => a.info.lastActive - b.info.lastActive);

    if (idleSessions.length === 0) {
      return false;
    }

    const oldest = idleSessions[0];
    if (oldest) {
      void this.destroyRuntime(oldest.botId, oldest.sessionId);
    }
    return true;
  }
}
