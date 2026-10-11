import { describe, it, expect, beforeEach } from 'vitest';
import { MockApiClient } from '../mock';

describe('MockApiClient', () => {
  let client: MockApiClient;

  beforeEach(() => {
    client = new MockApiClient();
  });

  describe('Health', () => {
    it('should return health status', async () => {
      const health = await client.ping();
      expect(health.status).toBe('ok');
      expect(health.version).toBeDefined();
    });
  });

  describe('Bots', () => {
    it('should return list of bots', async () => {
      const bots = await client.getBots();
      expect(Array.isArray(bots)).toBe(true);
      expect(bots.length).toBeGreaterThan(0);
    });

    it('should have a main bot', async () => {
      const bots = await client.getBots();
      const mainBot = bots.find(b => b.isMain);
      expect(mainBot).toBeDefined();
      expect(mainBot?.name).toBe('Chief');
    });

    it('should get bot by id', async () => {
      const bots = await client.getBots();
      const firstBot = bots[0];
      const bot = await client.getBot(firstBot.id);
      expect(bot.id).toBe(firstBot.id);
      expect(bot.name).toBe(firstBot.name);
    });

    it('should create new bot', async () => {
      const newBot = await client.createBot({
        name: 'Test Bot',
        role: 'Tester',
        instructions: 'Test instructions',
        model: {
          provider: 'deepseek',
          id: 'deepseek-chat',
        },
      });
      expect(newBot.name).toBe('Test Bot');
      expect(newBot.isMain).toBe(false);
    });
  });

  describe('Memory', () => {
    it('should search memory', async () => {
      const results = await client.searchMemory({ query: '用户' });
      expect(Array.isArray(results)).toBe(true);
    });

    it('should write memory', async () => {
      const entry = await client.writeMemory('bot-chief', {
        content: 'Test memory entry',
        scope: 'bot',
      });
      expect(entry.content).toBe('Test memory entry');
      expect(entry.scope).toBe('bot');
    });

    it('should get memory summary', async () => {
      const summary = await client.getMemorySummary('team');
      expect(typeof summary).toBe('string');
    });
  });

  describe('Tasks', () => {
    it('should list tasks', async () => {
      const tasks = await client.getTasks();
      expect(Array.isArray(tasks)).toBe(true);
    });

    it('should create task', async () => {
      const task = await client.createTask({
        name: 'Test Task',
        targetType: 'bot',
        targetId: 'bot-chief',
        message: 'Test message',
        schedule: {
          type: 'daily',
          time: '09:00',
        },
      });
      expect(task.name).toBe('Test Task');
      expect(task.enabled).toBe(true);
    });

    it('should toggle task', async () => {
      const tasks = await client.getTasks();
      const task = tasks[0];
      const toggled = await client.toggleTask(task.id, !task.enabled);
      expect(toggled.enabled).toBe(!task.enabled);
    });
  });

  describe('Usage', () => {
    it('should get usage stats', async () => {
      const stats = await client.getUsageStats('week');
      expect(stats.period).toBe('week');
      expect(stats.total).toBeDefined();
      expect(stats.total.inputTokens).toBeGreaterThan(0);
    });
  });

  describe('Contract models/sessions', () => {
    it('lists models grouped with auth flags', async () => {
      const catalog = await client.getModels();
      expect(catalog.models.length).toBeGreaterThan(0);
      expect(catalog.models.every((m) => typeof m.hasAuth === 'boolean')).toBe(true);
      expect(catalog.defaultModel).toEqual({ provider: 'deepseek', id: 'deepseek-v4-pro' });
    });

    it('manages sessions per bot', async () => {
      const created = await client.createSession('bot-chief', '测试会话');
      expect(created.name).toBe('测试会话');
      expect(created.isActive).toBe(true);
      const list = await client.listSessions('bot-chief');
      expect(list[0].id).toBe(created.id);
      const renamed = await client.updateSession('bot-chief', created.id, { name: '改名', thinking: 'high' });
      expect(renamed.name).toBe('改名');
      expect(renamed.thinking).toBe('high');
      const forked = await client.forkSession('bot-chief', created.id, 'head');
      expect(forked.id).not.toBe(created.id);
      await client.deleteSession('bot-chief', forked.id);
    });

    it('saves provider api keys', async () => {
      const result = await client.setProviderApiKey('anthropic', 'sk-test');
      expect(result.configured).toBe(true);
      const providers = await client.getProviders();
      expect(providers.find((p) => p.id === 'anthropic')?.configured).toBe(true);
    });
  });

  describe('Settings', () => {
    it('should get settings', async () => {
      const settings = await client.getSettings();
      expect(settings.language).toBeDefined();
      expect(settings.theme).toBeDefined();
      expect(settings.idleTimeoutMinutes).toBe(10);
      expect(settings.loadUserExtensions).toBe(false);
    });

    it('should update settings', async () => {
      const updated = await client.updateSettings({
        language: 'en-US',
      });
      expect(updated.language).toBe('en-US');
    });
  });
});
