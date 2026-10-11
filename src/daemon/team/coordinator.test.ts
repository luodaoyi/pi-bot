/**
 * Team coordinator tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TeamCoordinator } from '../team/coordinator.js';
import type { Store } from '../store/index.js';
import { SessionPool } from '../sessions/pool.js';
import type { BotConfig } from '#shared/index.js';
import { EventEmitter } from 'node:events';

// Mock Pi SDK
vi.mock('@earendil-works/pi-coding-agent', () => ({
  createAgentSession: vi.fn(),
  createAgentSessionServices: vi.fn(),
  createAgentSessionFromServices: vi.fn(() => ({
    session: {
      prompt: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(() => () => {}),
      setSessionName: vi.fn(),
      dispose: vi.fn(),
      abort: vi.fn(),
      getSessionStats: vi.fn(() => ({ tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }, cost: 0 })),
      getContextUsage: vi.fn(),
      sessionManager: {
        buildSessionContext: () => ({ messages: [], model: null, thinkingLevel: 'off' }),
        getEntries: () => [],
      },
    },
  })),
  getAgentDir: () => '/tmp/pi-agent',
  SessionManager: {
    create: vi.fn((_cwd: string, _dir?: string, options?: { id?: string }) => ({
      getSessionId: () => options?.id ?? 'test-session',
      getSessionFile: () => undefined,
      buildSessionContext: () => ({ messages: [], model: null, thinkingLevel: 'off' }),
      getEntries: () => [],
    })),
    open: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockReturnValue(undefined),
    forkFrom: vi.fn(),
  },
}));

// Mock implementations
class MockStore extends EventEmitter {
  private bots = new Map<string, BotConfig>();

  async getBot(id: string): Promise<BotConfig | null> {
    return this.bots.get(id) ?? null;
  }

  addBot(bot: BotConfig) {
    this.bots.set(bot.id, bot);
  }

  // Stub other methods
  async listBots() {
    return Array.from(this.bots.values());
  }
  async createBot() {
    return {} as BotConfig;
  }
  async updateBot() {
    return {} as BotConfig;
  }
  async deleteBot() {}
  async load() {}
  async save() {}
  async bootstrap() {}
  async getActiveSessionCount() {
    return 0;
  }
  onAny() {
    return () => {};
  }
}

describe('TeamCoordinator', () => {
  let store: MockStore;
  let sessionPool: SessionPool;
  let coordinator: TeamCoordinator;

  beforeEach(() => {
    store = new MockStore();
    sessionPool = new SessionPool({
      maxSessions: 10,
      idleTimeoutMs: 5000,
      sessionDir: '/tmp/test',
      workspaceDir: '/tmp/test-workspace',
      services: {
        cwd: '/tmp/test-workspace',
        agentDir: '/tmp/pi-agent',
        modelRuntime: {
          getModel: () => undefined,
          hasConfiguredAuth: () => false,
          getAvailable: async () => [],
        },
        settingsManager: {
          getDefaultProvider: () => undefined,
          getDefaultModel: () => undefined,
        },
        resourceLoader: {},
        diagnostics: [],
      } as never,
    });
    coordinator = new TeamCoordinator(store as unknown as Store, sessionPool);

    // Add test bots
    store.addBot({
      id: 'bot-1',
      name: 'Bot 1',
      role: 'assistant',
      instructions: 'Test bot 1',
      model: { provider: 'openai', id: 'gpt-4o' },
      isMain: false,
      created: new Date().toISOString(),
      segments: [],
    });

    store.addBot({
      id: 'bot-2',
      name: 'Bot 2',
      role: 'assistant',
      instructions: 'Test bot 2',
      model: { provider: 'openai', id: 'gpt-4o' },
      isMain: false,
      created: new Date().toISOString(),
      segments: [],
    });
  });

  afterEach(async () => {
    await sessionPool.destroy();
  });

  it('should send message from one bot to another', async () => {
    const sendSpy = vi.spyOn(sessionPool, 'sendMessage');

    const result = await coordinator.messageBot({
      from: 'bot-1',
      to: 'bot-2',
      message: 'Hello Bot 2',
      replyTo: 'me',
    });

    expect(result.messageId).toBeDefined();
    expect(result.exchangeId).toBeDefined();
    expect(sendSpy).toHaveBeenCalledWith(
      'bot-2',
      'Hello Bot 2',
      expect.any(Object),
      expect.objectContaining({
        from: 'bot-1',
        replyTo: 'me',
      })
    );
  });

  it('should throw error for non-existent sender', async () => {
    await expect(
      coordinator.messageBot({
        from: 'bot-999',
        to: 'bot-2',
        message: 'Hello',
      })
    ).rejects.toThrow('Sender bot not found');
  });

  it('should throw error for non-existent target', async () => {
    await expect(
      coordinator.messageBot({
        from: 'bot-1',
        to: 'bot-999',
        message: 'Hello',
      })
    ).rejects.toThrow('Target bot not found');
  });

  it('should create ask_user question', async () => {
    const result = await coordinator.askUser({
      from: 'bot-1',
      question: 'What should I do?',
    });

    expect(result.questionId).toBeDefined();

    const questions = coordinator.listPendingQuestions();
    expect(questions).toHaveLength(1);
    expect(questions[0].question).toBe('What should I do?');
  });

  it('should answer question', async () => {
    const { questionId } = await coordinator.askUser({
      from: 'bot-1',
      question: 'What is the answer?',
    });

    await coordinator.answerQuestion({
      questionId,
      answer: '42',
    });

    const questions = coordinator.listPendingQuestions();
    expect(questions).toHaveLength(0);
  });

  it('should throw error when answering non-existent question', async () => {
    await expect(
      coordinator.answerQuestion({
        questionId: 'q-nonexistent',
        answer: 'test',
      })
    ).rejects.toThrow('Question not found');
  });

  it('should list exchanges', async () => {
    await coordinator.messageBot({
      from: 'bot-1',
      to: 'bot-2',
      message: 'Test 1',
    });

    await coordinator.messageBot({
      from: 'bot-2',
      to: 'bot-1',
      message: 'Test 2',
    });

    const exchanges = coordinator.listExchanges();
    expect(exchanges).toHaveLength(2);
  });
});
