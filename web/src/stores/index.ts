import { create } from 'zustand';
import type { Bot, Message } from '@/types';
import { api, ApiError } from '@/api';
import type {
  ModelsResponse,
  ModelRef,
  PiModel,
  SessionDetail,
  SessionStats,
  SessionSummary,
  ThinkingLevel,
  ToolDisplayMode,
} from '@/api/types';
import { emptySessionStats } from '@/api/types';
import { isNotImplemented } from '@/api/normalize';
import { applyBotEvent, createChatRuntime, type ChatRuntime } from './chat-events';

interface AppState {
  bots: Bot[];
  selectedBotId: string | null;
  sessions: SessionSummary[];
  activeSessionId: string | null;
  sessionDetail: SessionDetail | null;
  chat: ChatRuntime;
  models: PiModel[];
  defaultModel: ModelRef | null;
  defaultThinking: ThinkingLevel | null;
  toolDisplay: ToolDisplayMode;
  sessionsSupported: boolean;
  loadBots: () => Promise<void>;
  selectBot: (id: string) => Promise<void>;
  createBot: (data: {
    name: string;
    role: string;
    instructions: string;
    model?: ModelRef | null;
    thinking?: ThinkingLevel | null;
  }) => Promise<Bot>;
  updateBot: (id: string, data: {
    name?: string;
    role?: string;
    instructions?: string;
    model?: ModelRef | null;
    thinking?: ThinkingLevel | null;
  }) => Promise<Bot>;
  loadModels: () => Promise<void>;
  loadSessions: (botId: string) => Promise<void>;
  selectSession: (botId: string, sessionId: string) => Promise<void>;
  newSession: (botId: string, name?: string) => Promise<void>;
  renameSession: (botId: string, sessionId: string, name: string) => Promise<void>;
  deleteSession: (botId: string, sessionId: string) => Promise<void>;
  forkSession: (botId: string, sessionId: string, entryId: string) => Promise<void>;
  setSessionModel: (botId: string, sessionId: string, model: ModelRef | null) => Promise<void>;
  setSessionThinking: (botId: string, sessionId: string, thinking: ThinkingLevel | null) => Promise<void>;
  sendMessage: (botId: string, content: string) => Promise<void>;
  abortChat: (botId: string) => Promise<void>;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  loading: boolean;
  sessionLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  setToolDisplay: (mode: ToolDisplayMode) => void;
}

let stopEvents: (() => void) | null = null;

function applySessionMeta(state: AppState, event: { type?: string; botId?: string; sessionId?: string; session?: SessionSummary }): Partial<AppState> | null {
  if (event.type !== 'session.created' && event.type !== 'session.updated') return null;
  if (event.botId && state.selectedBotId && event.botId !== state.selectedBotId) return null;
  const incoming = event.session;
  if (!incoming && !event.sessionId) return null;
  const id = incoming?.id ?? event.sessionId!;
  const existing = state.sessions.find((s) => s.id === id);
  const next: SessionSummary = {
    id,
    name: incoming?.name ?? existing?.name,
    createdAt: incoming?.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
    updatedAt: incoming?.updatedAt ?? new Date().toISOString(),
    messageCount: incoming?.messageCount ?? existing?.messageCount ?? 0,
    model: incoming?.model ?? existing?.model ?? null,
    thinking: incoming?.thinking ?? existing?.thinking ?? null,
    isActive: incoming?.isActive ?? existing?.isActive ?? id === state.activeSessionId,
  };
  const sessions = existing
    ? state.sessions.map((s) => (s.id === id ? { ...s, ...next } : s))
    : [next, ...state.sessions];
  sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { sessions };
}

function attachEvents(get: () => AppState, set: (partial: Partial<AppState>) => void) {
  if (stopEvents) return;
  stopEvents = api.subscribeEvents((event) => {
    const state = get();
    const meta = applySessionMeta(state, event);
    if (meta) {
      set(meta);
      return;
    }
    if (event.botId && state.selectedBotId && event.botId !== state.selectedBotId) return;
    if (event.sessionId && state.activeSessionId && event.sessionId !== state.activeSessionId) {
      if (event.type === 'bot.message_end' || event.type === 'bot.message_start') {
        const sessions = state.sessions.map((s) =>
          s.id === event.sessionId
            ? {
                ...s,
                messageCount: s.messageCount + (event.role === 'assistant' || event.type === 'bot.message_end' ? 1 : 0),
                updatedAt: new Date().toISOString(),
              }
            : s
        );
        set({ sessions });
      }
      return;
    }
    const chat = applyBotEvent(state.chat, event);
    const patch: Partial<AppState> = { chat };
    if (event.stats) {
      patch.sessionDetail = state.sessionDetail
        ? { ...state.sessionDetail, stats: event.stats }
        : state.sessionDetail;
    }
    if (event.type === 'bot.message_end' || event.type === 'bot.message_start') {
      patch.sessions = state.sessions.map((s) =>
        s.id === (event.sessionId || state.activeSessionId)
          ? { ...s, messageCount: Math.max(s.messageCount, chat.messages.length), updatedAt: new Date().toISOString() }
          : s
      );
    }
    set(patch);
  });
}

export const useAppStore = create<AppState>((set, get) => ({
  bots: [],
  selectedBotId: null,
  sessions: [],
  activeSessionId: null,
  sessionDetail: null,
  chat: createChatRuntime(),
  models: [],
  defaultModel: null,
  defaultThinking: null,
  toolDisplay: 'collapsed',
  sessionsSupported: true,
  sidebarOpen: true,
  loading: false,
  sessionLoading: false,
  error: null,

  loadBots: async () => {
    try {
      set({ loading: true, error: null });
      const bots = await api.getBots();
      const botsArray = Array.isArray(bots) ? bots : [];
      set({ bots: botsArray, loading: false });
      void get().loadModels();
      void api.getSettings().then((settings) => {
        set({ toolDisplay: settings.toolDisplay ?? 'collapsed' });
      }).catch(() => undefined);
      if (!get().selectedBotId && botsArray.length > 0) {
        const chief = botsArray.find((b) => b.isMain || b.name === 'Chief') ?? botsArray[0];
        await get().selectBot(chief.id);
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load bots',
        loading: false,
        bots: [],
      });
    }
  },

  loadModels: async () => {
    try {
      const data: ModelsResponse = await api.getModels();
      set({
        models: data.models,
        defaultModel: data.defaultModel,
        defaultThinking: data.defaultThinking,
      });
    } catch {
      set({ models: [] });
    }
  },

  selectBot: async (id: string) => {
    set({ selectedBotId: id, error: null, sessionLoading: true });
    attachEvents(get, set);
    await get().loadSessions(id);
  },

  loadSessions: async (botId: string) => {
    set({ sessionLoading: true });
    try {
      const sessions = await api.listSessions(botId);
      const active = sessions.find((s) => s.isActive) ?? sessions[0] ?? null;
      set({ sessions, sessionsSupported: true, activeSessionId: active?.id ?? null });
      if (active) {
        await get().selectSession(botId, active.id);
      } else {
        set({
          sessionDetail: null,
          chat: createChatRuntime(),
          sessionLoading: false,
        });
      }
    } catch (error) {
      if (isNotImplemented(error)) {
        try {
          const messages = await api.getChatHistory(botId);
          set({
            sessions: [],
            sessionsSupported: false,
            activeSessionId: null,
            sessionDetail: null,
            chat: createChatRuntime(messages),
            sessionLoading: false,
          });
        } catch (histError) {
          set({
            sessions: [],
            sessionsSupported: false,
            chat: createChatRuntime(),
            sessionLoading: false,
            error: histError instanceof Error ? histError.message : 'Failed to load history',
          });
        }
        return;
      }
      set({
        sessionLoading: false,
        sessions: [],
        chat: createChatRuntime(),
        error: error instanceof Error ? error.message : 'Failed to load sessions',
      });
    }
  },

  selectSession: async (botId: string, sessionId: string) => {
    set({ sessionLoading: true, error: null, activeSessionId: sessionId });
    try {
      try {
        await api.activateSession(botId, sessionId);
      } catch (error) {
        if (!isNotImplemented(error)) throw error;
      }
      const detail = await api.getSession(botId, sessionId);
      const messages: Message[] = detail.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp ?? new Date().toISOString(),
        thinking: m.thinking,
        toolCalls: m.toolCalls,
        error: m.error,
      }));
      set({
        sessionDetail: detail,
        sessions: get().sessions.map((s) => ({ ...s, isActive: s.id === sessionId })),
        chat: { ...createChatRuntime(messages), stats: detail.stats },
        sessionLoading: false,
      });
    } catch (error) {
      set({
        sessionLoading: false,
        error: error instanceof Error ? error.message : 'Failed to open session',
      });
    }
  },

  newSession: async (botId: string, name?: string) => {
    const session = await api.createSession(botId, name);
    set({ sessions: [session, ...get().sessions.map((s) => ({ ...s, isActive: false }))] });
    await get().selectSession(botId, session.id);
  },

  renameSession: async (botId: string, sessionId: string, name: string) => {
    const session = await api.updateSession(botId, sessionId, { name });
    set({
      sessions: get().sessions.map((s) => (s.id === sessionId ? { ...s, ...session } : s)),
      sessionDetail: get().sessionDetail
        ? { ...get().sessionDetail!, session: { ...get().sessionDetail!.session, ...session } }
        : null,
    });
  },

  deleteSession: async (botId: string, sessionId: string) => {
    await api.deleteSession(botId, sessionId);
    const remain = get().sessions.filter((s) => s.id !== sessionId);
    set({ sessions: remain });
    if (get().activeSessionId === sessionId) {
      if (remain[0]) await get().selectSession(botId, remain[0].id);
      else set({ activeSessionId: null, sessionDetail: null, chat: createChatRuntime() });
    }
  },

  forkSession: async (botId: string, sessionId: string, entryId: string) => {
    const session = await api.forkSession(botId, sessionId, entryId);
    set({ sessions: [session, ...get().sessions] });
    await get().selectSession(botId, session.id);
  },

  setSessionModel: async (botId: string, sessionId: string, model: ModelRef | null) => {
    const session = await api.updateSession(botId, sessionId, { model });
    set({
      sessions: get().sessions.map((s) => (s.id === sessionId ? { ...s, ...session } : s)),
      sessionDetail: get().sessionDetail
        ? { ...get().sessionDetail!, session: { ...get().sessionDetail!.session, ...session } }
        : null,
    });
  },

  setSessionThinking: async (botId: string, sessionId: string, thinking: ThinkingLevel | null) => {
    const session = await api.updateSession(botId, sessionId, { thinking });
    set({
      sessions: get().sessions.map((s) => (s.id === sessionId ? { ...s, ...session } : s)),
      sessionDetail: get().sessionDetail
        ? { ...get().sessionDetail!, session: { ...get().sessionDetail!.session, ...session } }
        : null,
    });
  },

  createBot: async (data) => {
    const bot = await api.createBot({
      name: data.name,
      role: data.role,
      instructions: data.instructions,
      model: data.model ?? null,
      thinking: data.thinking ?? null,
    });
    set({ bots: [...get().bots, bot] });
    await get().selectBot(bot.id);
    return bot;
  },

  updateBot: async (id, data) => {
    const bot = await api.updateBot(id, data);
    set({ bots: get().bots.map((item) => (item.id === id ? bot : item)) });
    return bot;
  },

  sendMessage: async (botId: string, content: string) => {
    attachEvents(get, set);
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    const chat = {
      ...get().chat,
      messages: [...get().chat.messages, userMessage],
      isStreaming: true,
      assistantId: null,
    };
    set({ chat, error: null });

    try {
      const accepted = await api.sendChat(botId, content, get().activeSessionId ?? undefined);
      set({
        chat: { ...get().chat, runId: accepted.runId },
        activeSessionId: accepted.sessionId || get().activeSessionId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send message';
      set({
        error: message,
        chat: applyBotEvent(get().chat, {
          type: 'bot.error',
          botId,
          sessionId: get().activeSessionId ?? '',
          runId: get().chat.runId ?? '',
          error: message,
        }),
      });
      if (error instanceof ApiError && error.status >= 500) {
        // 保持错误可见
      }
    }
  },

  abortChat: async (botId: string) => {
    try {
      await api.abortChat(botId, get().activeSessionId ?? undefined);
    } finally {
      set({ chat: { ...get().chat, isStreaming: false } });
    }
  },

  toggleSidebar: () => {
    set({ sidebarOpen: !get().sidebarOpen });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  setToolDisplay: (mode) => {
    set({ toolDisplay: mode });
  },
}));

export type { SessionStats };
