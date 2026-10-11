/**
 * Session pool tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionPool } from '../sessions/pool.js';
import type { BotConfig } from '@pi-bot/shared';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// Mock pi SDK
vi.mock('@earendil-works/pi-coding-agent', () => ({
  createAgentSession: vi.fn().mockResolvedValue({
    runtime: {},
    session: {
      setSessionName: vi.fn().mockResolvedValue(undefined),
      prompt: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      dispose: vi.fn().mockResolvedValue(undefined),
    },
  }),
  SessionManager: {
    create: vi.fn().mockResolvedValue({
      sessionPath: '/tmp/test',
      sessionId: 'test-session',
    }),
  },
}));

describe('SessionPool', () => {
  let pool: SessionPool;
  let testBot: BotConfig;

  beforeEach(() => {
    const sessionDir = join(tmpdir(), 'pi-bot-test', randomUUID());
    pool = new SessionPool({
      maxSessions: 2,
      idleTimeoutMs: 5000,
      sessionDir,
    });

    testBot = {
      id: 'test-bot-1',
      name: 'Test Bot',
      role: 'assistant',
      instructions: 'You are a test bot',
      model: {
        provider: 'deepseek',
        modelId: 'deepseek-chat',
      },
      isMain: false,
      created: new Date().toISOString(),
      segments: [],
    };
  });

  afterEach(async () => {
    await pool.destroy();
  });

  it('should create a session for a bot', async () => {
    const session = await pool.getSession(testBot);
    expect(session).toBeDefined();
    expect(session.botId).toBe(testBot.id);
    expect(session.info.status).toBe('idle');
  });

  it('should reuse existing session', async () => {
    const session1 = await pool.getSession(testBot);
    const session2 = await pool.getSession(testBot);
    expect(session1).toBe(session2);
  });

  it('should track session stats', async () => {
    await pool.getSession(testBot);
    const stats = pool.getStats();
    expect(stats.total).toBe(1);
    expect(stats.idle).toBe(1);
    expect(stats.maxSessions).toBe(2);
  });

  it('should enforce max sessions limit', async () => {
    const bot1: BotConfig = { ...testBot, id: 'bot-1' };
    const bot2: BotConfig = { ...testBot, id: 'bot-2' };
    const bot3: BotConfig = { ...testBot, id: 'bot-3' };

    await pool.getSession(bot1);
    await pool.getSession(bot2);

    // Third session should fail (max is 2)
    await expect(pool.getSession(bot3)).rejects.toThrow('Session pool at capacity');
  });

  it('should send message to bot', async () => {
    const session = await pool.getSession(testBot);
    await pool.sendMessage(testBot.id, 'Hello', testBot);
    expect(session.session.prompt).toHaveBeenCalledWith('Hello');
  });

  it('should destroy session', async () => {
    await pool.getSession(testBot);
    expect(pool.getStats().total).toBe(1);

    await pool.destroySession(testBot.id);
    expect(pool.getStats().total).toBe(0);
  });

  it('should emit events', async () => {
    const events: string[] = [];
    pool.on('session_created', () => events.push('created'));
    pool.on('session_destroyed', () => events.push('destroyed'));

    await pool.getSession(testBot);
    await pool.destroySession(testBot.id);

    expect(events).toEqual(['created', 'destroyed']);
  });
});
