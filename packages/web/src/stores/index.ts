// Global state management with Zustand

import { create } from 'zustand';
import type { Bot, Message, ChatSession } from '@/types';
import { createApiClient } from '@/api';

const api = createApiClient();

interface AppState {
  // Bots
  bots: Bot[];
  selectedBotId: string | null;
  loadBots: () => Promise<void>;
  selectBot: (id: string) => void;

  // Chat
  chatSessions: Map<string, ChatSession>;
  sendMessage: (botId: string, content: string) => Promise<void>;
  getChatSession: (botId: string) => ChatSession | undefined;
  
  // UI State
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  
  // Loading states
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
      set({ bots, loading: false });
      
      // Select first bot if none selected
      if (!get().selectedBotId && bots.length > 0) {
        set({ selectedBotId: bots[0].id });
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load bots',
        loading: false 
      });
    }
  },

  selectBot: (id: string) => {
    set({ selectedBotId: id });
    
    // Load chat history if not already loaded
    const session = get().chatSessions.get(id);
    if (!session) {
      api.getChatHistory(id).then(messages => {
        const sessions = new Map(get().chatSessions);
        sessions.set(id, {
          botId: id,
          messages,
          isStreaming: false,
        });
        set({ chatSessions: sessions });
      });
    }
  },

  sendMessage: async (botId: string, content: string) => {
    try {
      const sessions = new Map(get().chatSessions);
      const session = sessions.get(botId);
      
      if (!session) return;

      // Add user message
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

      // Send to API
      await api.sendMessage(botId, { content });

      // Start streaming response
      let assistantMessage: Message = {
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

      const cleanup = api.streamChat(botId, (event) => {
        const currentSessions = get().chatSessions;
        const currentSession = currentSessions.get(botId);
        if (!currentSession) return;

        const messages = [...currentSession.messages];
        const msgIndex = messages.findIndex(m => m.id === assistantMessage.id);
        
        if (msgIndex >= 0) {
          if (event.type === 'text_delta' && event.content) {
            messages[msgIndex].content += event.content;
          } else if (event.type === 'agent_settled') {
            messages[msgIndex].streaming = false;
            currentSession.isStreaming = false;
          }
          
          const newSessions = new Map(currentSessions);
          newSessions.set(botId, { ...currentSession, messages });
          set({ chatSessions: newSessions });
        }
      });

      // Cleanup will be called automatically by the API client
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
