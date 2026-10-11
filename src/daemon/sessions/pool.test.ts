/**
 * Session pool tests (mocked SDK)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionPool } from '../sessions/pool.js';
import type { BotConfig } from '#shared/index.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const sdkMocks = vi.hoisted(() => {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const abort = vi.fn().mockResolvedValue(undefined);
  return { prompt, abort };
});

vi.mock('@earendil-works/pi-coding-agent', () => ({
  createAgentSession: vi.fn(),
  createAgentSessionServices: vi.fn(),
  createAgentSessionFromServices: vi.fn().mockResolvedValue({
    session: {
      setSessionName: vi.fn(),
      prompt: sdkMocks.prompt,
      abort: sdkMocks.abort,
      subscribe: vi.fn(() => () => {}),
      dispose: vi.fn(),
      setModel: vi.fn().mockResolvedValue(undefined),
      setThinkingLevel: vi.fn(),
      getSessionStats: vi.fn(() => ({
        tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        cost: 0,
      })),
      getContextUsage: vi.fn(() => undefined),
      sessionManager: {
        buildSessionContext: () => ({ messages: [], model: null, thinkingLevel: 'off' }),
        getEntries: () => [],
      },
    },
  }),
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

function testBot(id = 'test-bot-1'): BotConfig {
  return {
    id,
    name: 'Test Bot',
    role: 'assistant',
    instructions: 'You are a test bot',
    model: { provider: 'openai', id: 'gpt-4o' },
    thinking: null,
    isMain: false,
    created: new Date().toISOString(),
    segments: [],
  };
}

const fakeServices = {
  cwd: '/tmp',
  agentDir: '/tmp/agent',
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
} as never;

describe('SessionPool', () => {
  let pool: SessionPool;

  beforeEach(() => {
    sdkMocks.prompt.mockClear();
    sdkMocks.abort.mockClear();
    const root = join(tmpdir(), 'pi-bot-test', randomUUID());
    pool = new SessionPool({
      maxSessions: 2,
      idleTimeoutMs: 5000,
      sessionDir: join(root, 'sessions'),
      workspaceDir: join(root, 'workspace'),
      services: fakeServices,
    });
  });

  afterEach(async () => {
    await pool.destroy();
  });

  it('should create a session for a bot', async () => {
    const session = await pool.getSession(testBot());
    expect(session).toBeDefined();
    expect(session.botId).toBe('test-bot-1');
    expect(session.info.status).toBe('idle');
  });

  it('should reuse existing session', async () => {
    const bot = testBot();
    const session1 = await pool.getSession(bot);
    const session2 = await pool.getSession(bot);
    expect(session1).toBe(session2);
  });

  it('should track session stats', async () => {
    await pool.getSession(testBot());
    const stats = pool.getStats();
    expect(stats.total).toBe(1);
    expect(stats.idle).toBe(1);
    expect(stats.maxSessions).toBe(2);
  });

  it('should enforce max sessions limit', async () => {
    const bot1 = testBot('bot-1');
    const bot2 = testBot('bot-2');
    const bot3 = testBot('bot-3');

    const session1 = await pool.getSession(bot1);
    const session2 = await pool.getSession(bot2);

    session1.info.status = 'active';
    session2.info.status = 'active';

    await expect(pool.getSession(bot3)).rejects.toThrow(/Session pool at capacity|no idle sessions to evict/);
  });

  it('should send message to bot', async () => {
    const bot = testBot();
    const session = await pool.getSession(bot);
    await pool.sendMessage(bot.id, 'Hello', bot);
    expect(session.session.prompt).toHaveBeenCalledWith('Hello');
  });

  it('startChat returns ids without awaiting prompt', async () => {
    const bot = testBot();
    let resolvePrompt: () => void = () => {};
    sdkMocks.prompt.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolvePrompt = resolve;
    }));

    const accepted = await pool.startChat(bot, 'Hello');
    expect(accepted.sessionId).toBeTruthy();
    expect(accepted.runId).toBeTruthy();
    expect(sdkMocks.prompt).toHaveBeenCalled();
    resolvePrompt();
  });

  it('abort calls session.abort', async () => {
    const bot = testBot();
    await pool.getSession(bot);
    const ok = await pool.abort(bot.id);
    expect(ok).toBe(true);
    expect(sdkMocks.abort).toHaveBeenCalled();
  });

  it('lists, creates, activates, and deletes sessions', async () => {
    const bot = testBot();
    const created = await pool.createBotSession(bot, 'Work');
    expect(created.name).toBe('Work');
    expect(created.isActive).toBe(true);

    const second = await pool.createBotSession(bot, 'Other');
    expect(second.isActive).toBe(true);

    const listed = await pool.listBotSessions(bot);
    expect(listed.length).toBe(2);

    const activated = await pool.activateBotSession(bot, created.id);
    expect(activated.id).toBe(created.id);
    expect(activated.isActive).toBe(true);

    await pool.deleteBotSession(bot, second.id);
    const after = await pool.listBotSessions(bot);
    expect(after.map((s) => s.id)).toEqual([created.id]);
  });

  it('should destroy session', async () => {
    await pool.getSession(testBot());
    expect(pool.getStats().total).toBe(1);

    await pool.destroySession('test-bot-1');
    expect(pool.getStats().total).toBe(0);
  });

  it('should emit events', async () => {
    const events: string[] = [];
    pool.on('session_created', () => events.push('created'));
    pool.on('session_destroyed', () => events.push('destroyed'));

    await pool.getSession(testBot());
    await pool.destroySession('test-bot-1');

    expect(events).toContain('created');
    expect(events).toContain('destroyed');
  });
});
