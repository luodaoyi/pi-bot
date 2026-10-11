// Global state management with Zustand

import { create } from 'zustand';
import type { Bot, Message, ChatSession } from '@/types';
import { api } from '@/api';

interface AppState {
  bots: Bot[];
  selectedBotId: string | null;
  loadBots: () => Promise<void>;
  selectBot: (id: string) => Promise<void>;
  createBot: (data: {
    name: string;
    role: string;
    instructions: string;
  }) => Promise<Bot>;

  chatSessions: Map<string, ChatSession>;
  sendMessage: (botId: string, content: string) => Promise<void>;
  getChatSession: (botId: string) => ChatSession | undefined;

  sidebarOpen: boolean;
  toggleSidebar: () => void;

  loading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  bots: [],
  selectedBotId: null,
  chatSessions: new Map(),
  sidebarOpen: true,
  loading: false,
  error: null,

  loadBots: async () => {
    try {
      set({ loading: true, error: null });
      const bots = await api.getBots();
      const botsArray = Array.isArray(bots) ? bots : [];
      set({ bots: botsArray, loading: false });

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

  selectBot: async (id: string) => {
    set({ selectedBotId: id });

    const existing = get().chatSessions.get(id);
    if (existing) {
      return;
    }

    try {
      const messages = await api.getChatHistory(id);
      const sessions = new Map(get().chatSessions);
      sessions.set(id, {
        botId: id,
        messages,
        isStreaming: false,
      });
      set({ chatSessions: sessions });
    } catch (error) {
      const sessions = new Map(get().chatSessions);
      sessions.set(id, {
        botId: id,
        messages: [],
        isStreaming: false,
      });
      set({
        chatSessions: sessions,
        error: error instanceof Error ? error.message : 'Failed to load history',
      });
    }
  },

  createBot: async (data) => {
    const bot = await api.createBot({
      name: data.name,
      role: data.role,
      instructions: data.instructions,
      model: { provider: 'deepseek', modelId: 'deepseek-chat' },
    });
    set({ bots: [...get().bots, bot] });
    await get().selectBot(bot.id);
    return bot;
  },

  sendMessage: async (botId: string, content: string) => {
    try {
      const sessions = new Map(get().chatSessions);
      let session = sessions.get(botId);

      if (!session) {
        session = { botId, messages: [], isStreaming: false };
        sessions.set(botId, session);
      }

      const userMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      };

      session.messages.push(userMessage);
      session.isStreaming = true;
      sessions.set(botId, { ...session });
      set({ chatSessions: new Map(sessions) });

      const assistantMessage: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        botId,
        streaming: true,
      };

      session.messages.push(assistantMessage);
      sessions.set(botId, { ...session });
      set({ chatSessions: new Map(sessions) });

      api.streamChat(botId, (event) => {
        const currentSessions = get().chatSessions;
        const currentSession = currentSessions.get(botId);
        if (!currentSession) return;

        const messages = [...currentSession.messages];
        const msgIndex = messages.findIndex((m) => m.id === assistantMessage.id);

        if (msgIndex >= 0) {
          if (event.type === 'text_delta' && event.content) {
            messages[msgIndex].content += event.content;
          } else if (event.type === 'agent_settled' || event.type === 'error') {
            messages[msgIndex].streaming = false;
            currentSession.isStreaming = false;
            if (event.type === 'error' && event.content && !messages[msgIndex].content) {
              messages[msgIndex].content = event.content;
            }
          }

          const newSessions = new Map(currentSessions);
          newSessions.set(botId, { ...currentSession, messages });
          set({ chatSessions: newSessions });
        }
      }, content);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to send message' });
    }
  },

  getChatSession: (botId: string) => {
    return get().chatSessions.get(botId);
  },

  toggleSidebar: () => {
    set({ sidebarOpen: !get().sidebarOpen });
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));
