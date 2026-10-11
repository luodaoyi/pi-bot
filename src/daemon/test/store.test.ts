/**
 * Tests for Store (state management and persistence)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Store, createStore } from '../store/index.js';
import type { Config } from '../src/config.js';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

describe('Store', () => {
  let testDir: string;
  let testConfig: Config;

  beforeEach(async () => {
    testDir = join(tmpdir(), `pi-bot-test-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });

    testConfig = {
      host: {
        home: testDir,
        apiPort: 16888,
      },
      pi: {
        defaultModel: 'deepseek-chat',
      },
      respire: {
        port: 15169,
        autostart: false,
      },
      memory: {
        backend: 'respire',
      },
    };
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Initialization', () => {
    it('should create store with default state', async () => {
      const store = await createStore(testConfig);

      const bots = await store.listBots();
      expect(bots).toEqual([]);
    });

    it('should create state directory if it does not exist', async () => {
      const store = await createStore(testConfig);
      await store.save();

      const statePath = join(testDir, 'state.json');
      const { stat } = await import('node:fs/promises');
      const stats = await stat(statePath);

      expect(stats.isFile()).toBe(true);
    });

    it('should load existing state from disk', async () => {
      const statePath = join(testDir, 'state.json');
      const existingState = {
        version: 1,
        workspaceId: 'test-workspace',
        mainBotIds: ['bot-123'],
        bots: {
          'bot-123': {
            id: 'bot-123',
            name: 'Test Bot',
            role: 'tester',
            instructions: 'Test instructions',
            model: { provider: 'openai', id: 'gpt-4o' },
            isMain: true,
            created: new Date().toISOString(),
            segments: [],
          },
        },
        groups: {},
        schedules: [],
        secrets: {},
        revision: 0,
      };

      await writeFile(statePath, JSON.stringify(existingState), 'utf-8');

      const store = await createStore(testConfig);
      const bots = await store.listBots();

      expect(bots).toHaveLength(1);
      expect(bots[0].name).toBe('Test Bot');
    });
  });

  describe('Bot CRUD operations', () => {
    let store: Store;

    beforeEach(async () => {
      store = await createStore(testConfig);
    });

    describe('createBot', () => {
      it('should create a new bot', async () => {
        const bot = await store.createBot({
          name: 'TestBot',
          role: 'Assistant',
          instructions: 'Help with tests',
          model: {
            provider: 'openai',
            id: 'gpt-4o',
          },
        });

        expect(bot.id).toMatch(/^bot-[a-f0-9]+$/);
        expect(bot.name).toBe('TestBot');
        expect(bot.role).toBe('Assistant');
        expect(bot.isMain).toBe(false);
      });

      it('should create a main bot', async () => {
        const bot = await store.createBot({
          name: 'Chief',
          role: 'Main',
          instructions: 'Lead bot',
          model: {
            provider: 'openai',
            id: 'gpt-4o',
          },
          isMain: true,
        });

        expect(bot.isMain).toBe(true);

        const bots = await store.listBots();
        expect(bots.some((b) => b.isMain)).toBe(true);
      });

      it('should emit bot_created event', async () => {
        const listener = vi.fn();
        store.onAny(listener);

        await store.createBot({
          name: 'EventBot',
          role: 'Eventer',
          instructions: 'Emit events',
          model: {
            provider: 'openai',
            id: 'gpt-4o',
          },
        });

        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'bot_created',
            bot: expect.objectContaining({
              name: 'EventBot',
            }),
          })
        );
      });

      it('should persist bot to disk', async () => {
        await store.createBot({
          name: 'PersistBot',
          role: 'Persistent',
          instructions: 'Stay around',
          model: {
            provider: 'openai',
            id: 'gpt-4o',
          },
        });

        const store2 = await createStore(testConfig);
        const bots = await store2.listBots();

        expect(bots.some((b) => b.name === 'PersistBot')).toBe(true);
      });
    });

    describe('getBot', () => {
      it('should retrieve a bot by ID', async () => {
        const created = await store.createBot({
          name: 'GetBot',
          role: 'Getter',
          instructions: 'Get me',
          model: {
            provider: 'openai',
            id: 'gpt-4o',
          },
        });

        const retrieved = await store.getBot(created.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved?.name).toBe('GetBot');
      });

      it('should return null for non-existent bot', async () => {
        const bot = await store.getBot('nonexistent-id');

        expect(bot).toBeNull();
      });
    });

    describe('listBots', () => {
      it('should list all bots', async () => {
        await store.createBot({
          name: 'Bot1',
          role: 'First',
          instructions: 'First bot',
          model: {
            provider: 'openai',
            id: 'gpt-4o',
          },
        });

        await store.createBot({
          name: 'Bot2',
          role: 'Second',
          instructions: 'Second bot',
          model: {
            provider: 'openai',
            id: 'gpt-4o',
          },
        });

        const bots = await store.listBots();

        expect(bots).toHaveLength(2);
        expect(bots.map((b) => b.name).sort()).toEqual(['Bot1', 'Bot2']);
      });

      it('should return empty array when no bots exist', async () => {
        const bots = await store.listBots();

        expect(bots).toEqual([]);
      });
    });

    describe('updateBot', () => {
      it('should update bot name', async () => {
        const bot = await store.createBot({
          name: 'OriginalName',
          role: 'Role',
          instructions: 'Instructions',
          model: {
            provider: 'openai',
            id: 'gpt-4o',
          },
        });

        const updated = await store.updateBot(bot.id, {
          name: 'UpdatedName',
        });

        expect(updated.name).toBe('UpdatedName');
        expect(updated.role).toBe('Role');
      });

      it('should update bot model', async () => {
        const bot = await store.createBot({
          name: 'ModelBot',
          role: 'Role',
          instructions: 'Instructions',
          model: {
            provider: 'openai',
            id: 'gpt-4o',
          },
        });

        const updated = await store.updateBot(bot.id, {
          model: {
            provider: 'deepseek',
            modelId: 'deepseek-reasoner',
          },
        });

        expect(updated.model?.id).toBe('deepseek-reasoner');
      });

      it('should emit bot_updated event', async () => {
        const bot = await store.createBot({
          name: 'EventBot',
          role: 'Role',
          instructions: 'Instructions',
          model: {
            provider: 'openai',
            id: 'gpt-4o',
          },
        });

        const listener = vi.fn();
        store.onAny(listener);

        await store.updateBot(bot.id, { name: 'NewName' });

        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'bot_updated',
            bot: expect.objectContaining({
              name: 'NewName',
            }),
          })
        );
      });

      it('should throw error when updating non-existent bot', async () => {
        await expect(
          store.updateBot('nonexistent-id', { name: 'Fail' })
        ).rejects.toThrow('Bot not found');
      });
    });

    describe('deleteBot', () => {
      it('should delete a bot', async () => {
        const bot = await store.createBot({
          name: 'DeleteMe',
          role: 'Role',
          instructions: 'Instructions',
          model: {
            provider: 'openai',
            id: 'gpt-4o',
          },
        });

        await store.deleteBot(bot.id);

        const retrieved = await store.getBot(bot.id);
        expect(retrieved).toBeNull();
      });

      it('should remove main bot from mainBotIds', async () => {
        const bot = await store.createBot({
          name: 'MainBot',
          role: 'Main',
          instructions: 'Instructions',
          model: {
            provider: 'openai',
            id: 'gpt-4o',
          },
          isMain: true,
        });

        await store.deleteBot(bot.id);

        const bots = await store.listBots();
        expect(bots.filter((b) => b.isMain)).toHaveLength(0);
      });

      it('should emit bot_deleted event', async () => {
        const bot = await store.createBot({
          name: 'EventBot',
          role: 'Role',
          instructions: 'Instructions',
          model: {
            provider: 'openai',
            id: 'gpt-4o',
          },
        });

        const listener = vi.fn();
        store.onAny(listener);

        await store.deleteBot(bot.id);

        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'bot_deleted',
            id: bot.id,
          })
        );
      });

      it('should throw error when deleting non-existent bot', async () => {
        await expect(store.deleteBot('nonexistent-id')).rejects.toThrow(
          'Bot not found'
        );
      });
    });
  });

  describe('Bootstrap', () => {
    it('should create Chief bot on first run', async () => {
      const store = await createStore(testConfig);
      await store.bootstrap();

      const bots = await store.listBots();

      expect(bots).toHaveLength(1);
      expect(bots[0]!.name).toBe('Chief');
      expect(bots[0]!.isMain).toBe(true);
      expect(bots[0]!.model).toBeNull();
    });

    it('migrates legacy deepseek-chat and custom models to null', async () => {
      const statePath = join(testDir, 'state.json');
      await writeFile(
        statePath,
        JSON.stringify({
          version: 1,
          workspaceId: 'ws',
          mainBotIds: ['bot-legacy'],
          bots: {
            'bot-legacy': {
              id: 'bot-legacy',
              name: 'Old Chief',
              role: 'main',
              instructions: 'old',
              model: { provider: 'deepseek', modelId: 'deepseek-chat' },
              isMain: true,
              created: new Date().toISOString(),
              segments: [],
            },
            'bot-custom': {
              id: 'bot-custom',
              name: 'Custom',
              role: 'x',
              instructions: 'x',
              model: 'custom/foo',
              isMain: false,
              created: new Date().toISOString(),
              segments: [],
            },
          },
          groups: {},
          schedules: [],
          secrets: {},
          revision: 1,
        }),
        'utf-8'
      );

      const store = await createStore(testConfig);
      const legacy = await store.getBot('bot-legacy');
      const custom = await store.getBot('bot-custom');
      expect(legacy?.model).toBeNull();
      expect(custom?.model).toBeNull();
    });

    it('should not create duplicate Chief bot', async () => {
      const store = await createStore(testConfig);
      await store.bootstrap();
      await store.bootstrap();

      const bots = await store.listBots();

      expect(bots).toHaveLength(1);
    });
  });

  describe('Event system', () => {
    let store: Store;

    beforeEach(async () => {
      store = await createStore(testConfig);
    });

    it('should register and unregister onAny listener', async () => {
      const listener = vi.fn();
      const unsubscribe = store.onAny(listener);

      await store.createBot({
        name: 'EventBot',
        role: 'Role',
        instructions: 'Instructions',
        model: {
          provider: 'deepseek',
          modelId: 'deepseek-chat',
        },
      });

      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      await store.createBot({
        name: 'EventBot2',
        role: 'Role',
        instructions: 'Instructions',
        model: {
          provider: 'deepseek',
          modelId: 'deepseek-chat',
        },
      });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should support multiple onAny listeners', async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      store.onAny(listener1);
      store.onAny(listener2);

      await store.createBot({
        name: 'EventBot',
        role: 'Role',
        instructions: 'Instructions',
        model: {
          provider: 'deepseek',
          modelId: 'deepseek-chat',
        },
      });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Persistence', () => {
    it('should increment revision on save', async () => {
      const store = await createStore(testConfig);

      await store.createBot({
        name: 'Bot1',
        role: 'Role',
        instructions: 'Instructions',
        model: {
          provider: 'deepseek',
          modelId: 'deepseek-chat',
        },
      });

      await store.createBot({
        name: 'Bot2',
        role: 'Role',
        instructions: 'Instructions',
        model: {
          provider: 'deepseek',
          modelId: 'deepseek-chat',
        },
      });

      const { readFile } = await import('node:fs/promises');
      const statePath = join(testDir, 'state.json');
      const content = await readFile(statePath, 'utf-8');
      const state = JSON.parse(content);

      expect(state.revision).toBeGreaterThan(0);
    });
  });
});
