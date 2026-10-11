/**
 * Group manager tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GroupManager } from '../groups/manager.js';
import type { Store } from '../store/index.js';
import { SessionPool } from '../sessions/pool.js';
import type { BotConfig } from '#shared/index.js';
import { EventEmitter } from 'node:events';

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

describe('GroupManager', () => {
  let store: MockStore;
  let sessionPool: SessionPool;
  let groupManager: GroupManager;

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
    vi.spyOn(sessionPool, 'sendMessage').mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 20))
    );
    groupManager = new GroupManager(store as unknown as Store, sessionPool);

    // Add test bots
    for (let i = 1; i <= 3; i++) {
      store.addBot({
        id: `bot-${i}`,
        name: `Bot ${i}`,
        role: 'assistant',
        instructions: `Test bot ${i}`,
        model: { provider: 'openai', id: 'gpt-4o' },
        isMain: i === 1,
        created: new Date().toISOString(),
        segments: [],
      });
    }
  });

  afterEach(async () => {
    await sessionPool.destroy();
  });

  it('should create a group', async () => {
    const group = await groupManager.createGroup({
      name: 'Test Group',
      notice: 'This is a test group',
      members: ['bot-1', 'bot-2'],
    });

    expect(group.id).toBeDefined();
    expect(group.name).toBe('Test Group');
    expect(group.members).toEqual(['bot-1', 'bot-2']);
    expect(group.admin).toContain('bot-1'); // First member becomes admin
  });

  it('should throw error for non-existent member', async () => {
    await expect(
      groupManager.createGroup({
        name: 'Invalid Group',
        members: ['bot-1', 'bot-999'],
      })
    ).rejects.toThrow('Bot not found');
  });

  it('should update group settings', async () => {
    const group = await groupManager.createGroup({
      name: 'Test Group',
      members: ['bot-1', 'bot-2'],
    });

    const updated = await groupManager.updateGroup(group.id, {
      name: 'Updated Group',
      mode: 'admin',
    });

    expect(updated.name).toBe('Updated Group');
    expect(updated.mode).toBe('admin');
  });

  it('should add and remove members', async () => {
    const group = await groupManager.createGroup({
      name: 'Test Group',
      members: ['bot-1', 'bot-2'],
    });

    const updated = await groupManager.updateGroup(group.id, {
      members: ['bot-1', 'bot-2', 'bot-3'],
    });

    expect(updated.members).toEqual(['bot-1', 'bot-2', 'bot-3']);

    const reduced = await groupManager.updateGroup(group.id, {
      members: ['bot-1'],
    });

    expect(reduced.members).toEqual(['bot-1']);
  });

  it('should delete a group', async () => {
    const group = await groupManager.createGroup({
      name: 'Test Group',
      members: ['bot-1', 'bot-2'],
    });

    await groupManager.deleteGroup(group.id);
    expect(groupManager.getGroup(group.id)).toBeNull();
  });

  it('should list groups', async () => {
    await groupManager.createGroup({
      name: 'Group 1',
      members: ['bot-1'],
    });

    await groupManager.createGroup({
      name: 'Group 2',
      members: ['bot-2'],
    });

    const groups = groupManager.listGroups();
    expect(groups).toHaveLength(2);
  });

  it('should prevent concurrent rounds in same group', async () => {
    const group = await groupManager.createGroup({
      name: 'Test Group',
      members: ['bot-1', 'bot-2'],
    });

    vi.spyOn(sessionPool, 'sendMessage').mockImplementation(async (botId: string) => {
      await new Promise((resolve) => setTimeout(resolve, 80));
      setTimeout(() => {
        sessionPool.emit('message_end', {
          type: 'message_end',
          botId,
          messageId: 'm',
          text: '[PASS]',
        });
      }, 0);
    });

    const firstRound = groupManager.postToGroup({
      groupId: group.id,
      message: 'Hello',
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    await expect(
      groupManager.postToGroup({
        groupId: group.id,
        message: 'Hi again',
      })
    ).rejects.toThrow('already running a round');

    await firstRound.catch(() => {});
  });
});
